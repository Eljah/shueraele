"""Run the full local build with captured evidence; dependencies installed first."""
from pathlib import Path
import argparse,subprocess,sys,shutil
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--pdf',action='store_true');args=p.parse_args()
node=shutil.which('node')
if not node:raise SystemExit('Node.js 18+ is required.')
(ROOT/'evidence').mkdir(exist_ok=True)
def run(command,log=None):
 if log:
  with (ROOT/'evidence'/log).open('w',encoding='utf8') as f:
   subprocess.run(command,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT,check=True)
 else:subprocess.run(command,cwd=ROOT,check=True)
for script in ['build_assets','build_script','build_lab']:
 run([sys.executable,'tools/'+script+'.py'])
run([node,'--test']+[str(x.relative_to(ROOT)) for x in sorted((ROOT/'tests').glob('*.test.cjs'))],'node-tests.tap')
run([sys.executable,'tests/assets_test.py'],'assets-tests.txt')
run([sys.executable,'tests/browser_smoke.py'])
run([sys.executable,'tools/build_book.py']+(['--pdf'] if args.pdf else []))
run([sys.executable,'tools/report.py'])
print('Build finished. Native Meta Spark was NOT run.')
