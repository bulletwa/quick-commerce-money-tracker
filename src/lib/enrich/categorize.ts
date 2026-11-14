import type { OrderType } from "../types";

// Rules are checked top to bottom: the first match wins, so specific categories come before broad ones.
// `only` limits a rule to restaurant dishes ("food") or store items ("grocery"):
// "Chicken Biryani" is a dish, "Chicken Curry Cut" is raw meat.
type Rule = { cat: string; re: RegExp; only?: OrderType };

const R = (cat: string, re: RegExp, only?: OrderType): Rule => ({ cat, re, only });

const RULES: Rule[] = [
  R("Meals & Combos", /\b(bowl|meal|combo|platter|thali|meal box|lunch box meal)\b/i, "food"),
  R("Tobacco", /classic (ice|double|balanced|refined|rich|low|mild|verve|connect|regular|milds|ultra)|\bwills\b|navy cut|four square|\bburst\b|marlboro|cigarette|gold ?flake|classic (regular|milds|ultra)|\bmond\b|tobacco|\bzippo\b|(?<!high)(?<!gas )\blighter\b|rolling paper/i),
  R("Health & Pharmacy", /tablets?\b|capsules?\b|syrup|\bcough\b|thermometer|nebuli[sz]er|blood pressure|glucometer|first aid|\bmask\b|saridon|zincovit|honitus|kaadha|shilajit|vitamin\b(?! c face)|supplement|\bors\b|bandage|antiseptic|pain relief|\bbalm\b|\bdigital (monitor|thermo)/i),
  R("Electronics & Appliances", /induction|cook ?top|inflator|extension (cable|cord)|\bcable\b|charger|adapter|power ?bank|ear ?(phone|bud)|headphone|speaker|\busb\b|\bbulb\b|\bled\b|string lights|torch|batter(y|ies)|iron box|kettle|trimmer|hair dryer|extension board|pixel light|vacuum|string lights|\bmixer grinder|\bfan\b|\bheater\b/i),
  R("Cleaning & Household", /detergent|cleaner|dish ?wash|toilet|tissue|garbage|trash bag|mosquito|repellent|good ?knight|all ?out|\bhit\b|mortein|odomos|phenyl|harpic|lizol|\bvim\b|freshener|naphthalene|bleach|floor|\bmop\b|scrub|sponge|\bsurf\b|napkin/i),
  R("Apparel & Accessories", /boxers?|\bbriefs?\b|innerwear|\bvests?\b|t-?shirts?|\bshirt\b|jeans|trousers?|\bshorts\b|\bsocks?\b|stockings|leggings|hoodie|jacket|\bkurta\b|\bsaree\b|\bbra\b|lingerie|balaclava|\bcap\b|cufflink|\btie\b(?! (&|and) cuff)|\bwallet\b|\bbelt\b|sunglass|flip[- ]?flop|slipper|\bshoe/i),
  R("Personal Care & Beauty", /soap|shampoo|conditioner|face ?wash|serum|sunscreen|sun ?screen|perfume|eau de|deo(dorant)?\b|body spray|toothpaste|tooth ?brush|mouthwash|razor|shaving|lotion|moisturi[sz]er|face cream|lip (balm|care)|hair (oil|gel|color)|beard|talc|condom|sanitary|pad[s]?\b|hand ?wash|body wash|bath (gloves|scrub)|exfoliat|kajal|nail|\bmakeup\b|lakme|derma co|face (pack|mask)|lipstick|eye ?liner|mascara|foundation|\bblush\b|compact powder|nail polish/i),
  R("Beverages", /coffee|nescafe|\bcappuccino\b|\blatte\b/i),
  R("Snacks", /haldiram|bikaji|\bbingo\b|kurkure|\blays\b|\bchips\b|namkeen|peanuts/i),
  R("Staples", /\b(mustard|sunflower|olive|groundnut|refined|soya ?bean|soyabean|rice bran|sesame|vegetable|cooking)? ?oil\b/i),
  R("Frozen Food", /frozen|\bfries\b(?=.*(pack|g\b))|ice cubes?|\bpeas\b(?=.*frozen)/i),
  R("Pasta & Instant Food", /noodle|maggi|wai ?wai|yippee|pasta|macaroni|vermicelli|spaghetti|instant|ready to eat|\bsoup\b|cup noodle|\bpoha\b mix|upma mix|\bmix\b(?=.*instant)|breakfast mix|upma/i, "grocery"),
  R("Meat & Seafood", /chicken|mutton|\bfish\b|prawn|\bkeema\b|seekh|kebab|kabab|licious|\beggs?\b(?=.*curry)|salami|sausage|\bham\b|crab|lamb/i, "grocery"),
  R("Sauces & Spices", /sauce|chutney|ketchup|mayo(nnaise)?|\bspread\b|pickle|vinegar|masala|spice|cardamom|elachi|jeera|cumin|turmeric|haldi|black pepper|pepper powder|cinnamon|clove|saffron|\bhing\b|mustard|ajwain|\bsalt\b|amchur|oregano|monosodium|bay leaf|tej patta|baking (powder|soda)|mishri(?! x)|\bhing\b/i, "grocery"),
  R("Biryani & Rice", /biryani|pulao|fried rice|rice bowl|khichdi|\bhyd\b/i, "food"),
  R("Pizza & Burgers", /pizza|burger|sandwich|\bwrap\b|\broll\b|\bfries\b|nugget|garlic bread|sub\b|momo/i, "food"),
  R("Indian Mains", /paneer|\bdal\b|curry|roti|naan|paratha|kulcha|thali|masala|butter chicken|chole|rajma|handi|tikka|kebab|kabab|dosa|idli|sambar|vada|uttapam|chaat|samosa|pav bhaji|sabzi|korma|tandoori|champaran|chicken|mutton|egg curry/i, "food"),
  R("Chinese & Asian", /noodle|manchurian|\bmomos?\b|sushi|ramen|hakka|schezwan|chowmein|chilli (chicken|paneer)|spring roll|thukpa|chopsuey|chop suey/i, "food"),
  R("Desserts", /ice ?cream|brownie|\bcake\b|gulab|jamun|dessert|pastry|kulfi|sundae|cheesecake|tiramisu|rasmalai|waffle|donut|doughnut|\bcone\b/i),
  R("Sweets & Chocolates", /chocolate|\bchoco\b|dairy ?milk|kinder|candy|toffee|kaju katli|katli|mithai|ladoo|laddu|barfi|\bsweets?\b|halwa|jalebi|peda|bournville|ferrero|snickers|kitkat|munch|five star|\bgems\b|mentos|polo\b|eclairs|lollipop|dark fantasy|milkybar/i),
  R("Beverages", /\bcoffee\b|\btea\b|\bchai\b|juice|\bcola\b|\bsoda\b|soft drink|lassi|\bshake\b|smoothie|\bwater\b|coconut water|\bcoke\b|pepsi|sprite|fanta|mirinda|thums up|\b7 ?up\b|limca|gatorade|energy drink|red ?bull|monster|sharbat|rooh afza|nimbooz|lemonade|mocktail|\bdrink\b|kombucha|beer\b|buttermilk|chaas|\btonic\b|squash|latte|\biced\b|\bcappuccino\b|\bsyrup\b(?=.*(rose|sharbat))/i),
  R("Dairy & Eggs", /\bmilk\b|curd|yogh?urt|\bdahi\b|butter|cheese|\bpaneer\b|\bghee\b|\beggs?\b|\bcream\b|\bkhoya\b|\bmawa\b|whey|\bbutter ?milk\b|\blassi\b/i),
  R("Fruits & Vegetables", /onion|tomato|potato|banana|apple|mango|spinach|palak|carrot|capsicum|bell pepper|coriander|lemon|lime\b|cucumber|vegetable|\bfruit|grape|orange|ginger|garlic|mushroom|coconut|cauliflower|\bgobi\b|kiwi|pomegranate|gourd|\blauki\b|sprouts?|lady ?finger|bhindi|green chilli|chilli\b|beans|\bpeas\b|\bcorn\b|beetroot|pumpkin|cabbage|lettuce|broccoli|\bmint\b|pudina|curry leaves|papaya|watermelon|melon|guava|\bpear\b|plum|cherry|strawberr|blueberr|pineapple|brinjal|baingan|radish|\bmooli\b|turnip|zucchini|avocado|\bdates?\b(?! and)|\bherbs?\b|salad|methi|sweet potato|\byam\b|jackfruit|litchi|lychee|fig\b|\bamla\b|raw banana|drumstick|ridge|betel|\bpaan\b/i),
  R("Breakfast & Cereal", /cereal|chocos|corn ?flakes|muesli|granola|oats\b|porridge|\bdalia\b|\bdaliya\b|wheat flakes/i),
  R("Snacks", /chips|namkeen|biscuit|cookie|kurkure|\blays\b|popcorn|wafer|bhujia|mixture|kachori|haldiram|bikaji|makhana|cracker|nachos|\bpuffs?\b|rusk|\bbar\b|protein bar|trail mix|snack|\bsev\b|murukku|chakli|papad|khakhra|\bpuri\b|pringles|doritos|bingo|too yumm|cheetos|crax|bhel|\bdry fruit/i),
  R("Dry Fruits & Nuts", /almond|cashew|\bkaju\b|pista|raisin|walnut|\bdates?\b|chironji|\bnuts?\b|peanut|fig\b|apricot|\bseeds?\b|cranberr|badam|akhrot|anjeer|makhana/i),
  R("Staples", /\batta\b|flour|\brice\b|\bdal\b|\boil\b|sugar|\bjaggery\b|besan|poha|pulses|rajma|chana|\bsooji\b|rava|lentil|moong|toor|urad|masoor|tea powder|\bmaida\b|\bsago\b|basmati|chickpea|soya|\bsalt\b/i),
  R("Bakery & Bread", /\bbread\b|\bbun\b|\bpav\b|rusk|toast|\bkulcha\b|croissant|bagel|\bloaf\b|\bbuns\b/i),
  R("Puja & Festive", /camphor|kapur|agarbatti|incense|\bdhoop\b|chunri|\btika\b|shringar|\bflowers?\b|\balta\b|\bpooja\b|\bpuja\b|rakhi|karwa|diya|\bkalash\b|\bsindoor\b|\bhaldi kumkum\b|mata\b/i),
  R("Hardware & Tools", /\btape\b|glue|fevi|lubricant|sealant|epoxy|adhesive|zip ties?|chain brush|\bscrew|\bdrill\b|\bplier|spanner|\bwrench\b|\bnail\b(?! polish)|\bhammer\b|motomax|\btool\b/i),
  R("Home & Kitchen", /lunch ?box|\bcloth\b|microfiber|\bbroom\b|jhadu|dust ?pan|comforter|curtain|\bplate|\bbottle\b|container|\bglass\b|\bmug\b|hanger|bucket|towel|bed ?sheet|\bpillow\b|\bmat\b|organi[sz]er|storage|chopper|peeler|kitchen|\bsteel\b|casserole|\bpot\b|\bpan\b|\bknife\b|spatula|tongs|\bjar\b|dustbin|\bgloves?\b|\bfoil\b|cling|lunchbox|tiffin|\bcup\b|\bspoon\b|\bfork\b|borosil|first ?aid box|chopstick|ashtray|measuring/i),
  R("Stationery, Gifts & Toys", /stationery|\bpens?\b|pencil|eraser|notebook|marker|brush pens?|paint|\bcolou?r\b(?!.*cream)|portrait|\bprint\b|rakhi|gift|karwa|\bdiya\b|\bpuja\b|\btoy\b|\btoys\b|\bplant\b|balloon|\bcard\b|cufflink|\btie\b|sticker|craft|\bkids?\b(?=.*(kit|set))|blaster|\bgames?\b|puzzle|\bdoll\b|\bkit\b|playing cards/i),
  R("Lifestyle & Accessories", /goggles|balaclava|flip[- ]?flop|slipper|yoga|\bshoe|\bcap\b|\bsocks?\b|jersey|\bbag\b|\bwallet\b|\bbelt\b|sunglass|\bwatch\b|\bumbrella\b|neck pillow|\bhelmet\b|gym|sports?|stockings|\bsocks?\b/i),
];

export function categorize(name: string, type: OrderType): string {
  for (const { cat, re, only } of RULES) {
    if (only && only !== type) continue;
    if (re.test(name)) return cat;
  }
  return type === "food" ? "Other Food" : "Other Grocery";
}

/** Strip pack sizes / counts so "Amul Taaza Milk 500 ml" merges with "Amul Taaza Milk 1 L". */
export function normalizeName(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, " ")
    .replace(/\b\d+(\.\d+)?\s?x\s?\d+(\.\d+)?\s?(g|gm|kg|ml|l|ltr|pcs?|pieces?)\b/gi, " ")
    .replace(/\b\d+(\.\d+)?\s?(g|gm|kg|ml|l|ltr|pc|pcs|pieces?|pack|units?)\b/gi, " ")
    .replace(/\bpack of \d+\b/gi, " ")
    .replace(/\bfresh\b/gi, " ")
    .replace(/\b(pouch|cigarettes?)\b/gi, " ") // Zepto adds packaging/type words that Blinkit and Swiggy omit
    .replace(/\s*[-–,]\s*(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s|]+|[\s|]+$/g, "") // stray "|" left where a pack size was removed ("Milk 500 ml | Pack" → "Milk | Pack")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
