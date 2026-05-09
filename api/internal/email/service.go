package email

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	htmltpl "html/template"
	"log/slog"
	"strings"
	texttpl "text/template"
	"time"

	"github.com/resend/resend-go/v2"
)

//go:embed templates/*
var templatesFS embed.FS

const defaultSendTimeout = 10 * time.Second

// supportedLocales mirrors mobile's i18n list. Anything outside this set
// falls back to "en" — never to a partially-translated locale.
var supportedLocales = map[string]bool{
	"en": true, "tr": true,
}

// Service renders a Template in the requested locale and posts it to
// Resend. It is fire-and-forget from caller perspective: returning an
// error never blocks the outer flow (account delete, export build).
type Service struct {
	client *resend.Client
	from   string
}

func NewService(client *resend.Client, from string) *Service {
	return &Service{client: client, from: from}
}

// Send renders + dispatches a single email. Returns ErrUnavailable when
// the service is nil, so callers can decide whether to log and continue.
func (s *Service) Send(ctx context.Context, in SendInput) error {
	if s == nil {
		return ErrUnavailable
	}
	if in.To == "" {
		return fmt.Errorf("email: empty recipient")
	}

	locale := normalizeLocale(in.Locale)
	subject, err := s.renderSubject(in.Template, locale, in.Vars)
	if err != nil {
		return err
	}
	html, err := s.renderHTML(in.Template, locale, in.Vars)
	if err != nil {
		return err
	}
	text, err := s.renderText(in.Template, locale, in.Vars)
	if err != nil {
		return err
	}

	params := &resend.SendEmailRequest{
		From:    s.from,
		To:      []string{in.To},
		Subject: subject,
		Html:    html,
		Text:    text,
	}
	if _, err := s.client.Emails.SendWithContext(ctx, params); err != nil {
		return fmt.Errorf("email: resend send: %w", err)
	}
	return nil
}

func normalizeLocale(loc string) string {
	loc = strings.ToLower(strings.SplitN(loc, "-", 2)[0])
	if supportedLocales[loc] {
		return loc
	}
	return "en"
}

// renderSubject reads the first line of the .txt template — convention
// is "Subject: <line>" so we keep template per-locale to one file each.
func (s *Service) renderSubject(name Template, locale string, vars map[string]any) (string, error) {
	raw, err := readTemplate(name, locale, "txt")
	if err != nil {
		return "", err
	}
	tpl, err := texttpl.New(string(name) + ".subject").Parse(raw)
	if err != nil {
		return "", fmt.Errorf("email: subject parse: %w", err)
	}
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, vars); err != nil {
		return "", fmt.Errorf("email: subject exec: %w", err)
	}
	full := buf.String()
	if !strings.HasPrefix(full, "Subject:") {
		return "", fmt.Errorf("email: %s/%s txt missing Subject: prefix", name, locale)
	}
	idx := strings.Index(full, "\n")
	if idx < 0 {
		return "", fmt.Errorf("email: %s/%s txt missing body", name, locale)
	}
	return strings.TrimSpace(full[len("Subject:"):idx]), nil
}

func (s *Service) renderHTML(name Template, locale string, vars map[string]any) (string, error) {
	raw, err := readTemplate(name, locale, "html")
	if err != nil {
		return "", err
	}
	tpl, err := htmltpl.New(string(name) + ".html").Parse(raw)
	if err != nil {
		return "", fmt.Errorf("email: html parse: %w", err)
	}
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, vars); err != nil {
		return "", fmt.Errorf("email: html exec: %w", err)
	}
	return buf.String(), nil
}

func (s *Service) renderText(name Template, locale string, vars map[string]any) (string, error) {
	raw, err := readTemplate(name, locale, "txt")
	if err != nil {
		return "", err
	}
	tpl, err := texttpl.New(string(name) + ".txt").Parse(raw)
	if err != nil {
		return "", fmt.Errorf("email: txt parse: %w", err)
	}
	var buf bytes.Buffer
	if err := tpl.Execute(&buf, vars); err != nil {
		return "", fmt.Errorf("email: txt exec: %w", err)
	}
	full := buf.String()
	idx := strings.Index(full, "\n")
	if idx < 0 {
		return full, nil
	}
	return strings.TrimSpace(full[idx+1:]), nil
}

func readTemplate(name Template, locale, ext string) (string, error) {
	candidates := []string{
		fmt.Sprintf("templates/%s.%s.%s", name, locale, ext),
		fmt.Sprintf("templates/%s.en.%s", name, ext),
	}
	for _, p := range candidates {
		raw, err := templatesFS.ReadFile(p)
		if err == nil {
			return string(raw), nil
		}
	}
	return "", fmt.Errorf("email: template %s not found for locale %s", name, locale)
}

// SendAsync wraps Send in a goroutine + structured log on failure. Use
// from request handlers that must not block on email delivery.
func SendAsync(s *Service, in SendInput) {
	if s == nil {
		return
	}
	go func() {
		// Detached context: the request may be done before Resend replies.
		ctx, cancel := context.WithTimeout(context.Background(), defaultSendTimeout)
		defer cancel()
		if err := s.Send(ctx, in); err != nil {
			slog.Warn("email send failed", "template", in.Template, "to", in.To, "err", err)
		}
	}()
}
