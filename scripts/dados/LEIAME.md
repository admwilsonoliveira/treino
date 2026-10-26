# Banco de alimentos (src/data/alimentos.json)

Gerado por estes programas. Não edite o JSON à mão.

1. Baixar a TACO oficial: `Taco-4a-Edicao.xlsx` em https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/Taco-4a-Edicao.xlsx (NEPA/Unicamp).
2. Baixar o USDA FoodData Central SR Legacy (CSV, abril/2018, licença CC0): https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
3. `node taco2json.cjs <app>/node_modules/xlsx Taco-4a-Edicao.xlsx taco.json`
4. `python gera_banco.py taco.json mapa.json <pasta do SR Legacy> ../../src/data/alimentos.json`

`mapa.json` liga cada alimento frequente da TACO ao equivalente do USDA (de onde vêm vitamina D, B12, folato, vitamina E, vitamina K e selênio) e lista alimentos que a TACO não tem. Leite americano é fortificado com vitamina D: use sempre as versões "without added vitamin A and vitamin D".
5. IBGE (POF 2008-2009, dado público): baixar `tabelacompleta.zip` em https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabelas_de_Composicao_Nutricional_dos_Alimentos_Consumidos_no_Brasil/ e `tabelamedidas_bd.zip` em .../Tabela_de_Medidas_Referidas_para_os_Alimentos_Consumidos_no_Brasil/ e extrair os .xls.
6. `node ibge2json.cjs <app>/node_modules/xlsx tabelacompleta.xls tabelamedidas_bd.xls ../../src/data/alimentos.json` (acrescenta ~1.850 preparações "como consumidas" e as medidas caseiras, inclusive nos alimentos da TACO; itens que são só a TACO pura não são duplicados).
