# Gera src/data/alimentos.json a partir da TACO oficial (taco.json) + USDA SR Legacy (CC0) + mapa curado.
import csv, json, sys
taco_json, mapa_json, usda_dir, saida = sys.argv[1:5]
taco = json.load(open(taco_json, encoding='utf-8')); mapa = json.load(open(mapa_json, encoding='utf-8'))
foods = {r['description']: r['fdc_id'] for r in csv.DictReader(open(usda_dir + '/food.csv', encoding='utf-8'))}
MICRO = {'1114': 'vitD', '1178': 'b12', '1190': 'folato', '1109': 'vitE', '1185': 'vitK', '1103': 'selenio'}
FULL = {'1008': 'kcal', '1003': 'prot', '1005': 'carb', '1004': 'gord', '1258': 'sat', '1292': 'mono', '1293': 'poli', '1079': 'fibra', '2000': 'acucar',
        '1253': 'colest', '1093': 'sodio', '1087': 'calcio', '1089': 'ferro', '1090': 'magnesio', '1091': 'fosforo', '1092': 'potassio', '1095': 'zinco',
        '1098': 'cobre', '1101': 'manganes', '1106': 'vitA', '1162': 'vitC', '1165': 'b1', '1166': 'b2', '1167': 'b3', '1175': 'b6'}
FULL.update(MICRO)
O3 = {'1404', '1278', '1272'}  # ômega-3: ALA + EPA + DHA
precisa = {foods[x[1]] for x in mapa['taco']} | {foods[x[1]] for x in mapa['usdaSo']}
nut = {}
for r in csv.DictReader(open(usda_dir + '/food_nutrient.csv', encoding='utf-8')):
    f, n = r['fdc_id'], r['nutrient_id']
    if f not in precisa: continue
    if n in FULL: nut.setdefault(f, {})[FULL[n]] = float(r['amount'])
    elif n in O3: d = nut.setdefault(f, {}); d['omega3'] = d.get('omega3', 0) + float(r['amount'])
UN = {'cup': 'xícara', 'cup, chopped': 'xícara picada', 'cup chopped': 'xícara picada', 'cup, chopped or diced': 'xícara picada', 'cup, diced': 'xícara em cubos',
      'cup, sliced': 'xícara fatiada', 'cup slices': 'xícara fatiada', 'cup, cubes': 'xícara em cubos', 'cup, mashed': 'xícara amassada', 'cup, shredded': 'xícara ralada',
      'cup shredded': 'xícara ralada', 'cup (8 fl oz)': 'xícara (240 ml)', 'tbsp': 'colher de sopa', 'tablespoon': 'colher de sopa', 'tsp': 'colher de chá',
      'large': 'unidade grande', 'medium': 'unidade média', 'small': 'unidade pequena', 'slice': 'fatia', 'fillet': 'filé', 'leaf': 'folha',
      'fruit without refuse': 'unidade (sem casca e caroço)', 'olive': 'azeitona', 'thigh without skin': 'coxa sem pele'}
FR = {0.25: '1/4', 0.5: '1/2', 0.75: '3/4', 1.0: '1', 1.5: '1 e 1/2', 2.0: '2', 3.0: '3'}
med = {}
for r in csv.DictReader(open(usda_dir + '/food_portion.csv', encoding='utf-8')):
    if r['fdc_id'] in precisa and r['modifier'] in UN:
        a = float(r['amount'] or 1)
        if a not in FR: continue
        lst = med.setdefault(r['fdc_id'], []); nome = FR[a] + ' ' + UN[r['modifier']]
        if not any(x['n'] == nome for x in lst): lst.append({'n': nome, 'g': round(float(r['gram_weight']), 1)})
def r3(v): return None if v is None else round(v, 3)
CAMPOS = ['kcal', 'prot', 'carb', 'gord', 'sat', 'mono', 'poli', 'fibra', 'acucar', 'colest', 'sodio', 'calcio', 'ferro', 'magnesio', 'fosforo', 'potassio', 'zinco', 'cobre', 'manganes',
          'vitA', 'vitC', 'b1', 'b2', 'b3', 'b6', 'b12', 'folato', 'vitD', 'vitE', 'vitK', 'selenio', 'omega3']
ligado = {x[0]: foods[x[1]] for x in mapa['taco']}
itens = []
for x in taco:
    it = {'id': 't' + str(x['id']), 'nome': x['nome'], 'grupo': x['grupo'], 'f': 'TACO'}
    for c in CAMPOS:
        if x.get(c) is not None: it[c] = r3(x[c])
    fdc = ligado.get(x['id'])
    if fdc:
        u = nut.get(fdc, {})
        for c in MICRO.values():
            if c in u: it[c] = r3(u[c])
        it['usda'] = int(fdc)
        if fdc in med: it['med'] = med[fdc][:6]
    itens.append(it)
for nome, desc, grupo in mapa['usdaSo']:
    fdc = foods[desc]; u = nut.get(fdc, {})
    it = {'id': 'u' + fdc, 'nome': nome, 'grupo': grupo, 'f': 'USDA', 'usda': int(fdc)}
    for c in CAMPOS:
        if c in u: it[c] = r3(u[c])
    if fdc in med: it['med'] = med[fdc][:6]
    itens.append(it)
out = {'versao': 1, 'fontes': {
  'TACO': 'Tabela Brasileira de Composição de Alimentos (TACO), 4ª ed. revisada e ampliada, NEPA/Unicamp, 2011 (arquivo Taco-4a-Edicao.xlsx do site do NEPA)',
  'USDA': 'USDA FoodData Central, SR Legacy (abril/2018), licença CC0 1.0 (domínio público): vitamina D, B12, folato (DFE), vitamina E, vitamina K e selênio, e alimentos que a TACO não tem'},
  'itens': itens}
json.dump(out, open(saida, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('itens', len(itens), 'com USDA', sum(1 for i in itens if 'usda' in i), 'com medidas', sum(1 for i in itens if 'med' in i))
amostra = {'t488', 't589', 't561', 't277'}
for i in itens:
    if i['id'] in amostra or i['nome'].startswith('Whey') or i['nome'].startswith('Atum em lata'): print(json.dumps(i, ensure_ascii=False)[:420])
