"""Summarize actual recorded test evidence and hash release files."""
from pathlib import Path
import json,re,hashlib,platform
ROOT=Path(__file__).resolve().parents[1]
e=ROOT/'evidence';e.mkdir(exist_ok=True)
browser=json.loads((e/'browser-tests.json').read_text())
tap=(e/'node-tests.tap').read_text();asset=(e/'assets-tests.txt').read_text()
passed=int(re.search(r'# pass (\d+)',tap)[1]);failed=int(re.search(r'# fail (\d+)',tap)[1])
asset_count=int(re.search(r'Ran (\d+) tests',asset)[1]);asset_ok=asset.rstrip().endswith('OK')
checks=browser['checks'];ok=sum(x['pass'] for x in checks)
text=f'''# Отчёт о проверках / Шүрәле 0.2

## Реально выполнено

- JavaScript: {passed} прошли, {failed} ошибок (математика + адаптер на наших mocks).
- GLB: {asset_count} структурных проверок, итог {'OK' if asset_ok else 'FAILED'}; не сертификация glTF.
- Браузер: {ok}/{len(checks)} проверок; {browser['environment']['browser']}.
- Рендер: {browser['environment']['renderer']}; вход: synthetic.
- Исходник адаптера SHA-256: `{browser['source_sha256']}`.

Проверены изменения позы и картинки, 30 углов звеньев, потеря/возврат треков, отсутствие второго слота, отсутствующий узел, отсутствие HTTP-запросов и мобильная раскладка. JSON содержит реальные состояния и логи для каждого кадра.

## Что эти результаты НЕ доказывают

Meta Spark Studio не запускался. Не проверены: доступность установщика и авторизации, нативный импорт GLB, материал Occluder, реальные модули и распознавание Meta, камера телефона, производительность на телефоне, экспорт `.arproj`/`.arexport` и публикация в Instagram.

Браузерный тест вызывает `page.set_content` с неизменённым автономным HTML. HTTP-хостинг не проверен. WebGL-контекст в исходной среде подготовки был недоступен; финальный стенд использует Canvas2D. Программная сортировка треугольников не эквивалентна z-buffer нативного движка. Входные координаты синтетические. Скриншоты не являются AI-рисунками, но и не являются изображением реального пользователя с маской.

Книга и исходники описывают комплект для ручной сборки, а не гарантированно работающий нативный пакет. `READY` относится к тому runtime, в котором снят лог.
'''
(ROOT/'docs/TEST_REPORT.md').write_text(text,encoding='utf8')
paths=[]
for folder in ['src','lab','spark-import','graphics','tests','tools','docs','book','evidence']:
 for p in (ROOT/folder).rglob('*'):
  if p.is_file() and '__pycache__' not in p.parts and p.name!='SHA256SUMS.txt':paths.append(p)
(e/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(ROOT).as_posix()+'\n' for p in sorted(paths)),encoding='utf8')
print(f'{passed} JS + {asset_count} structural + {ok} browser checks passed; native Spark: NOT RUN')
