# Banco de alimentos (src/data/alimentos.json)

Gerado por estes programas. Não edite o JSON à mão.

1. Baixar a TACO oficial: `Taco-4a-Edicao.xlsx` em https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/Taco-4a-Edicao.xlsx (NEPA/Unicamp).
2. Baixar o USDA FoodData Central SR Legacy (CSV, abril/2018, licença CC0): https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
3. `node taco2json.cjs <app>/node_modules/xlsx Taco-4a-Edicao.xlsx taco.json`
4. `python gera_banco.py taco.json mapa.json <pasta do SR Legacy> ../../src/data/alimentos.json`

`mapa.json` liga cada alimento frequente da TACO ao equivalente do USDA (de onde vêm vitamina D, B12, folato, vitamina E, vitamina K e selênio) e lista alimentos que a TACO não tem. Leite americano é fortificado com vitamina D: use sempre as versões "without added vitamin A and vitamin D".
