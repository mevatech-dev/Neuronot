package crisis_keywords

import "strings"

// These seed lists are intentionally conservative and must receive native
// speaker review before production launch for each language.
var byLanguage = map[string][]string{
	"en": {"kill myself", "harm myself", "suicide", "end my life", "sudden confusion", "one-sided weakness", "trouble speaking"},
	"tr": {"kendime zarar", "intihar", "hayatıma son", "ani bilinç", "tek taraflı güçsüzlük", "konuşma bozukluğu"},
	"es": {"suicidio", "hacerme daño", "quitarme la vida", "debilidad en un lado"},
	"de": {"suizid", "mir schaden", "einseitige schwäche", "sprachstörung"},
	"fr": {"suicide", "me faire du mal", "faiblesse d'un côté", "trouble de la parole"},
	"pt": {"suicídio", "me machucar", "tirar minha vida", "fraqueza de um lado"},
	"it": {"suicidio", "farmi del male", "togliermi la vita", "debolezza da un lato"},
	"ar": {"انتحار", "إيذاء نفسي", "ضعف في جهة واحدة", "صعوبة في الكلام"},
	"ru": {"суицид", "навредить себе", "покончить с собой", "слабость с одной стороны"},
	"ja": {"自殺", "自分を傷つける", "片側の脱力", "話しにくい"},
	"zh": {"自杀", "伤害自己", "结束生命", "单侧无力", "说话困难"},
}

func Contains(language string, texts []string) bool {
	keywords := byLanguage[language]
	if len(keywords) == 0 {
		keywords = byLanguage["en"]
	}
	for _, text := range texts {
		lower := strings.ToLower(text)
		for _, keyword := range keywords {
			if strings.Contains(lower, strings.ToLower(keyword)) {
				return true
			}
		}
	}
	return false
}
