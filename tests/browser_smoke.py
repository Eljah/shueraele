"""Real browser screenshots of shipped models + adapter running on OUR mocks.
No Meta Spark, no webcam, no face/hand inference. A passing test is not native E2E.
"""
from pathlib import Path
import json, os, shutil, hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
for d in ['evidence','book/figures']:(ROOT/d).mkdir(parents=True,exist_ok=True)
results=[];states={}; errors=[]; requests=[]
def check(name,ok):
 results.append({'name':name,'pass':bool(ok)})
 if not ok:raise AssertionError(name)
with sync_playwright() as p:
 options={'headless':True,'args':['--no-sandbox']}
 exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
 if exe:options['executable_path']=exe
 browser=p.chromium.launch(**options)
 page=browser.new_page(viewport={'width':1260,'height':1070},device_scale_factor=1)
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('https:','http:')) else None)
 page.set_content((ROOT/'lab/preview.html').read_text(encoding='utf8'),wait_until='load')
 page.wait_for_function('window.SH_LAB_READY === true',timeout=15000)
 def tick(t):page.evaluate('(t)=>SH_LAB_SET_TIME(t)',t)
 def snap(name):
  states[name]=page.evaluate('SH_LAB_STATE')
  page.screenshot(path=str(ROOT/'evidence'/f'{name}.png'),full_page=True)
  return states[name]
 def setval(id,value):page.locator('#'+id).evaluate('(el,v)=>{el.value=String(v);el.dispatchEvent(new Event("input"));}',value)
 tick(1.25);s=snap('debug-01-ready');a=page.locator('canvas').screenshot(path=str(ROOT/'book/figures/assets_front.png'))
 check('Exact generated adapter booted with both mock tracking slots',s['status']=='ready' and s['enabledSlots']==[0,1])
 check('Renderer draws all four shipped GLB models',s['triangles']==1020)
 check('All 30 animated nodes contain numeric rotations',len([v for hand in s['fingerAngles'] for finger in hand for v in finger if isinstance(v,(int,float))])==30)
 tick(2.5);s2=snap('debug-02-animation');b=page.locator('canvas').screenshot()
 check('Time changes adapter-driven finger angles AND rendered pixels',s['fingerAngles']!=s2['fingerAngles'] and a!=b)
 setval('power',0);tick(2.5);c=page.locator('canvas').screenshot()
 check('Intensity control affects the real adapter output',b!=c)
 setval('power',.8);setval('yaw',45);tick(1.25);snap('debug-03-side')
 page.locator('canvas').screenshot(path=str(ROOT/'book/figures/assets_side.png'))
 check('Yaw changes the projected image of the same GLB geometry',a!=page.locator('canvas').screenshot())
 setval('yaw',0);setval('hands',0);tick(1.25);lost=snap('debug-04-hands-lost')
 check('Losing both hand detections hides both rigs, not the horn',lost['handVisible']==[False,False] and lost['hornVisible'])
 setval('hands',2);setval('faces',0);tick(1.25);noface=snap('debug-05-face-lost')
 check('Losing the face hides the horn, not independently tracked hands',not noface['hornVisible'] and noface['handVisible']==[True,True])
 setval('faces',1);tick(1.25)
 check('Reacquisition restores visibility without reboot',page.evaluate('SH_LAB_STATE.hornVisible'))
 page.evaluate('SH_LAB_SET_MODE("oneSlot")');tick(1.25);one=snap('debug-06-single-slot')
 check('Unsupported second slot degrades to one visible hand',one['enabledSlots']==[0] and one['handVisible']==[True,False])
 page.evaluate('SH_LAB_SET_MODE("missing")');tick(1.25);missing=snap('debug-07-missing-node')
 check('Missing imported node produces a diagnostic error and hides graphics',missing['status']=='error' and not missing['hornVisible'] and missing['handVisible']==[False,False])
 page.evaluate('SH_LAB_SET_MODE("normal")');tick(1.25)
 check('Provenance label is visibly included in screenshots',page.get_by_text('СИНТЕТИЧЕСКАЯ ПОЗА · РЕНДЕР GLB · НЕ ЗАПУСК META SPARK').is_visible())
 check('No HTTP or HTTPS requests were made',not requests)
 page.set_viewport_size({'width':390,'height':844});tick(1.25);snap('debug-08-mobile')
 check('Mobile layout has no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 check('No uncaught JavaScript errors',not errors)
 version=browser.version;browser.close()
report={'environment':{'browser':'Chromium '+version,'renderer':'Canvas2D/software','input':'synthetic','spark_runtime':False,'navigation':'set_content of unchanged standalone HTML, NOT HTTP hosting'},'checks':results,'states':states,'errors':errors,'http_requests':requests,'source_sha256':hashlib.sha256((ROOT/'spark-import/scripts/shurale.js').read_bytes()).hexdigest()}
(ROOT/'evidence/browser-tests.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'passed':len(results),'checks':results},ensure_ascii=False,indent=2))
