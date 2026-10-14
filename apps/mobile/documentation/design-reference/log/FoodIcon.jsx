import React from 'react';
// Food → colorful illustrated icon (Noto Emoji CDN) in a soft tinted container.
// Resolution: specific food item (≈115 across 10 categories) → explicit `category` → category keyword → "Other".
const N = (hex) => `https://fonts.gstatic.com/s/e/notoemoji/latest/${hex}/emoji.svg`;
const cat = (id, label, hex, tint, keywords, items) => ({
  id, label, src: N(hex), tint, keywords,
  items: items.map(([name, h, match]) => ({ name, src: N(h), match })),
});

// Display order. Within each category, more specific patterns come first.
export const FOOD_CATEGORIES = [
  cat('baked', 'Baked Goods', '1f950', 'amber', /bread|toast|bagel|croissant|muffin|bun|roll|pastry|baguette|pita|tortilla|wrap|cracker|pancake|waffle|biscuit|scone/i, [
    ['Croissant', '1f950', /croissant/i],
    ['Muffin', '1f9c1', /muffin/i],
    ['Scone & Biscuit', '1f36a', /scone|\bbiscuits?\b|shortbread/i],
    ['Bao Bun', '1f95f', /\bbao\b|steamed bun|pork bun/i],
    ['Cornbread', '1f33d', /cornbread|corn bread|polenta cake/i],
    ['Baguette', '1f956', /baguette|french bread|ciabatta/i],
    ['Bagel', '1f96f', /bagel/i],
    ['Pretzel', '1f968', /pretzel/i],
    ['Flatbread', '1fad3', /flatbread|pita|naan|tortilla|wrap\b|chapati|lavash/i],
    ['Pancakes', '1f95e', /pancake|crepe|hotcake/i],
    ['Waffle', '1f9c7', /waffle/i],
    ['Sandwich', '1f96a', /sandwich|sub\b|panini|club/i],
    ['Rice Cracker', '1f358', /rice cake|rice cracker|cracker/i],
    ['Mooncake', '1f96e', /mooncake|moon cake|danish|pastry|strudel/i],
    ['Fortune Cookie', '1f960', /fortune cookie/i],
    ['Bread', '1f35e', /bread|toast|loaf|bun\b|roll\b|brioche|sourdough|rye/i],
    ['Flour & Grains', '1f33e', /flour|wheat|whole grain|semolina|barley|spelt/i],
  ]),
  cat('meat', 'Meats', '1f969', 'neutral', /meat|beef|steak|pork|lamb|ham|bacon|sausage|turkey|veal|mince|burger|jerky|chicken|duck/i, [
    // Poultry
    ['Chicken Breast', '1f414', /chicken breast|chicken fillet|chicken cutlet|chicken schnitzel|grilled chicken|chicken escalope/i],
    ['Chicken Leg', '1f357', /chicken leg|drumstick|chicken thigh|leg quarter/i],
    ['Chicken Wings', '1f357', /chicken wing|\bwings\b|buffalo wing|hot wing/i],
    ['Whole Chicken', '1f413', /whole chicken|roast chicken|rotisserie|spatchcock|\bhen\b/i],
    ['Chicken', '1f357', /chicken|poultry|nugget|\\btenders?\\b/i],
    ['Deli Meat', '1f96a', /deli meat|cold cuts|lunch meat|sliced turkey|sliced ham/i],
    ['Turkey', '1f983', /turkey/i],
    ['Duck', '1f986', /duck|goose/i],
    ['Quail', '1f426', /quail(?! eggs?)|pheasant|partridge|pigeon|game bird/i],
    // Pork
    ['Pork Chop', '1f356', /pork chop|pork cutlet|tonkatsu|schnitzel/i],
    ['Pork Belly', '1f953', /pork belly|crackling|lechon|samgyeopsal/i],
    ['Bacon', '1f953', /bacon|pancetta|prosciutto/i],
    ['Ham', '1f356', /\bham\b|gammon/i],
    ['Spare Ribs', '1f356', /spare ?ribs?|baby back|pork ribs?|\bribs\b/i],
    ['Pulled Pork', '1f437', /pulled pork|carnitas|pork shoulder|pork loin|pork tenderloin|char siu/i],
    ['Pork', '1f416', /pork|pig/i],
    // Beef
    ['T-Bone', '1f969', /t-?bone|porterhouse|tomahawk/i],
    ['Steak', '1f969', /ribeye|rib eye|sirloin|striploin|filet mignon|beef tenderloin|fillet steak|rump|flank|skirt steak|steak/i],
    ['Ground Beef', '1f42e', /ground beef|minced beef|beef mince|\bmince\b|meatloaf|beef patty/i],
    ['Meatballs', '1f9c6', /meatballs?|kofta|polpette|köttbullar/i],
    ['Corned Beef', '1f96b', /corned beef|\bspam\b|luncheon meat/i],
    ['BBQ', '1f356', /bbq|barbecue|bulgogi|asado|churrasco|pot roast|roast beef|brisket/i],
    ['Beef', '1f969', /beef|veal|jerky/i],
    ['Oxtail', '1f402', /oxtail|\box\b|short rib|beef cheek/i],
    ['Bison', '1f9ac', /bison|buffalo/i],
    // Lamb, game & other
    ['Lamb Chop', '1f356', /lamb chop|lamb cutlet|rack of lamb|lamb rack|leg of lamb|lamb shank/i],
    ['Lamb', '1f411', /lamb|mutton/i],
    ['Wild Boar', '1f417', /boar/i],
    ['Venison', '1f98c', /venison|deer|elk|game meat/i],
    ['Rabbit', '1f407', /rabbit/i],
    ['Goat', '1f410', /\bgoat\b(?! cheese|'s cheese| milk)/i],
    ['Burger', '1f354', /burger|hamburger|patty/i],
    ['Hot Dog', '1f32d', /hot ?dog|sausage|frankfurter|bratwurst|chorizo|salami|pepperoni/i],
    ['Gyro', '1f959', /gyro|kebab|doner|shawarma|souvlaki/i],
    ['Skewer', '1f362', /skewer|satay|yakitori/i],
  ]),
  cat('veg', 'Vegetables', '1f966', 'green', /vegetable|veg|broccoli|carrot|spinach|kale|lettuce|pepper|tomato|cucumber|zucchini|potato|onion|mushroom|cabbage|greens/i, [
    ['Salad', '1f957', /(?<!fruit )salad/i],
    ['Broccoli', '1f966', /broccoli|cauliflower|vegetables?\b|veggies/i],
    ['Carrot', '1f955', /carrot/i],
    ['Tomato', '1f345', /tomato/i],
    ['Sweet Potato', '1f360', /sweet potato|yam/i],
    ['Potato', '1f954', /potato|mash/i],
    ['Corn', '1f33d', /corn|maize/i],
    ['Cucumber', '1f952', /cucumber|pickle|zucchini|courgette/i],
    ['Hot Pepper', '1f336', /chili pepper|chilli pepper|hot pepper|jalape|habanero|cayenne|\bchilli\b/i],
    ['Bell Pepper', '1fad1', /pepper|capsicum|paprika/i],
    ['Eggplant', '1f346', /eggplant|aubergine/i],
    ['Leafy Greens', '1f96c', /lettuce|spinach|kale|greens|leafy|cabbage|arugula|rocket|chard|bok choy/i],
    ['Portobello', '1f344_200d_1f7eb', /portobello|cremini|shiitake|porcini|chestnut mushroom/i],
    ['Mushroom', '1f344', /mushroom/i],
    ['Onion', '1f9c5', /onion|shallot|leek|scallion/i],
    ['Garlic', '1f9c4', /garlic/i],
    ['Ginger', '1fada', /ginger|turmeric|galangal/i],
    ['Root Veg', '1fadc', /beet|radish|turnip|parsnip|root veg|celeriac|rutabaga/i],
    ['Pumpkin', '1f383', /pumpkin|squash|butternut/i],
    ['Herbs', '1f33f', /herb|basil|parsley|cilantro|coriander|\bmint\b|\bdill\b|rosemary|thyme|oregano/i],
    ['Peas', '1fadb', /\bpeas?\b|green bean|snap pea/i],
    ['Avocado', '1f951', /avocado|guacamole/i],
  ]),
  cat('seafood', 'Seafood', '1f990', 'indigo', /seafood|shrimp|prawn|crab|lobster|mussel|oyster|clam|squid|octopus|scallop|fish/i, [
    ['Sushi', '1f363', /sushi|sashimi|nigiri|maki/i],
    ['Tempura', '1f364', /tempura|fried shrimp|scampi/i],
    ['Shrimp', '1f990', /shrimp|prawn/i],
    ['Fish Cake', '1f365', /fish cake|surimi|kamaboko|imitation crab/i],
    ['Lobster', '1f99e', /lobster|crayfish/i],
    ['Crab', '1f980', /crab/i],
    ['Squid', '1f991', /squid|calamari/i],
    ['Octopus', '1f419', /octopus/i],
    ['Oyster', '1f9aa', /oyster/i],
    ['Shellfish', '1f41a', /mussel|clam|scallop|shellfish|cockle|whelk/i],
    ['Pufferfish', '1f421', /puffer|fugu|blowfish|monkfish/i],
    ['Tuna', '1f420', /tuna|mackerel|sardine|anchov|trout|tilapia|sea bass/i],
    ['Fish', '1f41f', /salmon|fish|cod|haddock|halibut|pollock/i],
  ]),
  cat('fruit', 'Fruit', '1f353', 'green', /fruit|berry|grape|orange|pear|peach|mango|pineapple|melon|kiwi|cherry|plum|lemon|apple|banana/i, [
    ['Pineapple', '1f34d', /pineapple/i],
    ['Green Apple', '1f34f', /green apple|granny smith/i],
    ['Apple', '1f34e', /apple/i],
    ['Banana', '1f34c', /banana|plantain/i],
    ['Orange', '1f34a', /orange|grapefruit|mandarin|clementine|tangerine|citrus/i],
    ['Lime', '1f34b_200d_1f7e9', /\blimes?\b|key lime/i],
    ['Lemon', '1f34b', /lemon/i],
    ['Pear', '1f350', /pear/i],
    ['Peach', '1f351', /peach|nectarine|apricot/i],
    ['Cherries', '1f352', /cherr/i],
    ['Blueberries', '1fad0', /blueberr|blackberr|acai/i],
    ['Strawberry', '1f353', /strawberr|raspberr|berries/i],
    ['Grapes', '1f347', /grape|raisin/i],
    ['Watermelon', '1f349', /watermelon/i],
    ['Melon', '1f348', /melon|cantaloupe|honeydew/i],
    ['Mango', '1f96d', /mango|papaya/i],
    ['Kiwi', '1f95d', /kiwi/i],
    ['Dates', '1f334', /\bdates?\b|medjool|tropical fruit/i],
    ['Dragon Fruit', '1f335', /dragon ?fruit|pitaya|prickly pear|cactus/i],
    ['Mixed Fruit', '1f9fa', /mixed fruit|fruit salad|fruit bowl|fruit cup|fruit platter/i],
  ]),
  cat('nuts', 'Nuts and Seeds', '1f95c', 'amber', /nut|seed|almond|walnut|cashew|pistachio|peanut|hazelnut|pecan|chia|flax|sunflower|sesame|bean|lentil/i, [
    ['Nut Butter', '1fad9', /peanut butter|nut butter|almond butter|tahini|nutella/i],
    ['Peanuts', '1f95c', /peanut|almond|cashew|pistachio|trail mix|mixed nuts/i],
    ['Chestnut', '1f330', /chestnut(?! mushroom)|walnut|hazelnut|pecan|macadamia|brazil nut/i],
    ['Pine Nuts', '1f332', /pine nut/i],
    ['Coconut', '1f965', /coconut/i],
    ['Sunflower Seeds', '1f33b', /sunflower|pumpkin seed|pepita|sesame/i],
    ['Chia & Flax', '1f331', /chia|flax|hemp|sprout|seeds?\b/i],
    ['Edamame', '1fadb', /edamame|soybean|soy bean/i],
    ['Beans & Lentils', '1fad8', /bean|lentil|chickpea|hummus|legume|tofu|tempeh/i],
    ['Olives', '1fad2', /olive/i],
  ]),
  cat('dairy', 'Dairy and Eggs', '1f9c0', 'indigo', /dairy|milk|cheese|yogurt|yoghurt|butter|cream|kefir|cottage|mozzarella|feta|egg/i, [
    ['Fried Egg', '1f373', /fried egg|omelet|omelette|scrambled|frittata/i],
    ['Egg', '1f95a', /\beggs?\b|boiled egg|egg white/i],
    ['Goat Cheese', '1f410', /goat cheese|goat's cheese|chèvre|chevre/i],
    ['Cheese', '1f9c0', /cheese|mozzarella|feta|cheddar|parmesan|brie|ricotta|halloumi|gouda/i],
    ['Yogurt', '1f963', /yogurt|yoghurt|skyr|kefir|quark/i],
    ['Butter', '1f9c8', /butter|ghee/i],
    ['Cream', '1fad7', /\bcream\b(?! cheese)|sour cream|whipped|half.and.half|creamer/i],
    ['Milk', '1f95b', /milk/i],
    ['Dairy Cow', '1f404', /whole milk|farm|raw milk|dairy\b/i],
    ['Baby Formula', '1f37c', /formula|baby bottle/i],
  ]),
  cat('drinks', 'Drinks', '1f964', 'indigo', /drink|water|soda|juice|smoothie|shake|tea|coffee|latte|cola|beer|wine|kombucha/i, [
    ['Bubble Tea', '1f9cb', /bubble tea|boba/i],
    ['Coffee', '2615', /coffee|latte|espresso|cappuccino|americano|mocha|flat white/i],
    ['Herbal Tea', '1fad6', /herbal|chamomile|peppermint tea|rooibos|infusion|teapot/i],
    ['Tea', '1f375', /\btea\b|matcha|chai/i],
    ['Mate', '1f9c9', /\bmate\b|yerba/i],
    ['Iced Drink', '1f9ca', /\biced\b|ice water|(?<!shaved )\bice\b(?! cream)/i],
    ['Smoothie', '1f379', /smoothie|shake|frapp/i],
    ['Juice', '1f9c3', /juice|lemonade/i],
    ['Kombucha', '1fad7', /kombucha|kvass/i],
    ['Soda', '1f964', /soda|\bcola\b|soft drink|energy drink|sports drink|sparkling water/i],
    ['Pint', '1f37b', /\bpint|draft|draught/i],
    ['Beer', '1f37a', /beer|lager|\bale\b|cider|stout|ipa\b/i],
    ['Sparkling Wine', '1f942', /rosé|rose wine|sparkling wine|spritz|mimosa/i],
    ['Wine', '1f377', /wine/i],
    ['Champagne', '1f37e', /champagne|prosecco|cava/i],
    ['Cocktail', '1f378', /cocktail|martini|margarita|mojito/i],
    ['Spirits', '1f943', /spirit|liquor|whisk|vodka|\brum\b|\bgin\b|tequila|brandy/i],
    ['Sake', '1f376', /\bsake\b|soju/i],
    ['Water', '1f4a7', /\bwater\b/i],
  ]),
  cat('sweets', 'Sweets', '1f369', 'amber', /candy|chocolate|cake|cookie|donut|doughnut|ice cream|dessert|brownie|pie\b|gummy/i, [
    ['Birthday Cake', '1f382', /birthday cake|layer cake/i],
    ['Cupcake', '1f9c1', /cupcake/i],
    ['Cake', '1f370', /(?<!moon |fish |rice )\bcakes?\b|cheesecake|tiramisu|brownie|sponge cake/i],
    ['Pie', '1f967', /\bpie\b|tart|crumble/i],
    ['Doughnut', '1f369', /donut|doughnut/i],
    ['Cookie', '1f36a', /(?<!fortune )cookie/i],
    ['Chocolate', '1f36b', /chocolate|cocoa|candy bar/i],
    ['Candy', '1f36c', /candy|sweets|gumm|toffee|caramel/i],
    ['Lollipop', '1f36d', /lollipop/i],
    ['Ice Cream', '1f368', /ice cream|gelato|sorbet/i],
    ['Soft Serve', '1f366', /soft serve|frozen yogurt|froyo/i],
    ['Shaved Ice', '1f367', /shaved ice|slushie|granita/i],
    ['Custard', '1f36e', /custard|pudding|flan|creme brulee/i],
    ['Honey', '1f36f', /honey|syrup|jam/i],
    ['Mochi', '1f361', /mochi|dango/i],
  ]),
  cat('other', 'Other', '1f371', 'neutral', null, [
    ['Custom Meal', '1f374', /custom|my meal|homemade|generic/i],
    ['Bento', '1f371', /bento|meal prep|lunch box/i],
    ['Pizza', '1f355', /pizza/i],
    ['Taco', '1f32e', /taco/i],
    ['Burrito', '1f32f', /burrito|quesadilla/i],
    ['Tamale', '1fad4', /tamale/i],
    ['Pasta', '1f35d', /pasta|spaghetti|penne|lasagn|macaroni|noodle(?! soup)|linguine/i],
    ['Ramen', '1f35c', /ramen|pho|noodle soup|udon/i],
    ['Curry', '1f35b', /curry|dal|masala/i],
    ['Stew', '1f372', /stew|\bchili\b(?! pepper)|soup|hot pot|goulash/i],
    ['Paella', '1f958', /paella|casserole|risotto|stir.?fry/i],
    ['Takeout', '1f961', /takeout|take-out|chinese food|lo mein|chow mein|fried rice|orange chicken/i],
    ['Rice Ball', '1f359', /onigiri|rice ball/i],
    ['Rice', '1f35a', /\brice\b|quinoa|grain|couscous|bulgur/i],
    ['Oatmeal', '1f963', /\boats?\b|oatmeal|porridge|granola|muesli|cereal/i],
    ['Dumpling', '1f95f', /dumpling|gyoza|pierogi|wonton/i],
    ['Falafel', '1f9c6', /falafel/i],
    ['Fries', '1f35f', /fries|chips|wedges/i],
    ['Popcorn', '1f37f', /popcorn/i],
    ['Fondue', '1fad5', /fondue/i],
    ['Canned Food', '1f96b', /canned|tin\b/i],
    ['Salt & Seasoning', '1f9c2', /salt|seasoning|spice|sauce|dressing|ketchup|mayo/i],
    ['Plated Meal', '1f37d_fe0f', /plate|platter|\bdinner\b|\bmeal\b|leftovers|home.?cooked/i],
  ]),
];

// Match order: dishes and drinks before ingredients, so "Apple juice" → juice and
// "Chicken burrito" → burrito, but "Chicken breast" → chicken.
const MATCH_ORDER = ['drinks', 'sweets', 'baked', 'other', 'seafood', 'meat', 'nuts', 'dairy', 'veg', 'fruit'];
const ITEMS = MATCH_ORDER.flatMap(id => {
  const c = FOOD_CATEGORIES.find(x => x.id === id);
  return c.items.map(it => ({ ...it, tint: c.tint, category: c.id }));
});
const OTHER = FOOD_CATEGORIES[FOOD_CATEGORIES.length - 1];
// Generic food (fork & knife) — used for custom meals and any name that matches nothing.
export const GENERIC_FOOD_ICON = N('1f374');

const TINTS = {
  indigo: { bg: 'rgba(99,102,241,0.12)' },
  green: { bg: 'rgba(34,197,94,0.12)' },
  amber: { bg: 'rgba(245,158,11,0.12)' },
  neutral: { bg: '#F1F5F9' },
};

const findCategory = (idOrLabel) =>
  idOrLabel ? FOOD_CATEGORIES.find(c => c.id === idOrLabel || c.label.toLowerCase() === String(idOrLabel).toLowerCase()) : null;

export function categorizeFood(name) {
  if (!name) return OTHER;
  const item = ITEMS.find(it => it.match.test(name));
  if (item) return findCategory(item.category);
  return FOOD_CATEGORIES.find(c => c.keywords && c.keywords.test(name)) || OTHER;
}

export function foodIllustration(name, category) {
  const item = name ? ITEMS.find(it => it.match.test(name)) : null;
  const explicit = findCategory(category);
  const keyword = name ? FOOD_CATEGORIES.find(c => c.keywords && c.keywords.test(name)) : null;
  const c = explicit || (item ? findCategory(item.category) : keyword) || OTHER;
  // Nothing recognised and no category given → neutral fork & knife, not the bento.
  const src = item ? item.src : (explicit || keyword) ? c.src : GENERIC_FOOD_ICON;
  return { src, tint: item ? item.tint : c.tint, category: c.id, fallback: GENERIC_FOOD_ICON };
}

function Illustration({ src, fallback, size }) {
  const [current, setCurrent] = React.useState(src);
  React.useEffect(() => setCurrent(src), [src]);
  return (
    <img src={current} alt="" width={size} height={size} style={{ display: 'block' }}
      onError={() => setCurrent(current !== fallback ? fallback : GENERIC_FOOD_ICON)} />
  );
}

export function FoodIcon({ name, category, size, generic }) {
  const s = size || 48;
  const ic = generic ? { src: GENERIC_FOOD_ICON, tint: 'indigo', fallback: GENERIC_FOOD_ICON } : foodIllustration(name, category);
  const t = TINTS[ic.tint] || TINTS.neutral;
  return (
    <div style={{ width: s, height: s, borderRadius: s * 0.42, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Illustration src={ic.src} fallback={ic.fallback} size={s * 0.52} />
    </div>
  );
}

// Category tile: icon + label, selectable — for "browse by category" grids and filter rows.
export function FoodCategoryIcon({ category, size, selected, showLabel, onClick }) {
  const c = findCategory(category) || OTHER;
  const s = size || 52;
  const t = TINTS[c.tint] || TINTS.neutral;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={onClick ? 'v2-press' : undefined} aria-pressed={onClick ? !!selected : undefined} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, width: s + 18,
      background: 'none', border: 'none', padding: 0, cursor: onClick ? 'pointer' : 'default', font: 'inherit'
    }}>
      <div style={{
        width: s, height: s, borderRadius: s * 0.42, background: selected ? 'rgba(99,102,241,0.18)' : t.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: selected ? '0 0 0 2px #6366F1' : 'none', transition: 'box-shadow var(--dur-fast) var(--ease-out)'
      }}>
        <Illustration src={c.src} fallback={OTHER.src} size={s * 0.54} />
      </div>
      {showLabel !== false && (
        <span style={{ font: 'var(--weight-semibold) 11px/1.2 var(--font-sans)', color: selected ? '#4F46E5' : 'var(--text-secondary)', textAlign: 'center' }}>{c.label}</span>
      )}
    </Tag>
  );
}
