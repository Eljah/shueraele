#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'spark-import/scripts/shurale.js'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text('// Shurale Necrolab 0.2.0. Generated from src/. See docs before import.\n'+(ROOT/'src/motion.js').read_text()+'\n'+(ROOT/'src/spark-driver.js').read_text(),encoding='utf8')
print(out)
