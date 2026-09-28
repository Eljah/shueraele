"""Structural checks for our generated GLB subset; not Khronos certification."""
import json,struct,unittest,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def load(path):
 b=path.read_bytes();magic,version,length=struct.unpack_from('<4sII',b)
 assert magic==b'glTF' and version==2 and length==len(b)
 n,typ=struct.unpack_from('<I4s',b,12);assert typ==b'JSON'
 d=json.loads(b[20:20+n]);size,typ=struct.unpack_from('<I4s',b,20+n)
 assert typ==b'BIN\0' and size==len(b)-28-n
 return d,b[28+n:]
class Assets(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.items={p.name:load(p) for p in (ROOT/'spark-import/objects').glob('*.glb')}
 def test_four_containers(self):self.assertEqual(set(self.items),{'horn.glb','hand_0.glb','hand_1.glb','head_occluder.glb'})
 def test_buffer_ranges(self):
  for d,b in self.items.values():
   self.assertEqual(d['buffers'][0]['byteLength'],len(b))
   for v in d['bufferViews']:self.assertLessEqual(v.get('byteOffset',0)+v['byteLength'],len(b))
 def test_indices(self):
  for d,b in self.items.values():
   for mesh in d['meshes']:
    for p in mesh['primitives']:
     a=d['accessors'][p['indices']];v=d['bufferViews'][a['bufferView']]
     indices=struct.unpack_from('<'+'H'*a['count'],b,v['byteOffset']+a.get('byteOffset',0))
     self.assertLess(max(indices),d['accessors'][p['attributes']['POSITION']]['count'])
 def test_finite_positions(self):
  for d,b in self.items.values():
   for a in d['accessors']:
    if a['componentType']!=5126:continue
    v=d['bufferViews'][a['bufferView']];n=a['count']*{'VEC2':2,'VEC3':3}[a['type']]
    self.assertTrue(all(math.isfinite(x) for x in struct.unpack_from('<'+'f'*n,b,v['byteOffset'])))
 def test_joint_names(self):
  for slot in [0,1]:
   names={n['name'] for n in self.items[f'hand_{slot}.glb'][0]['nodes']}
   expected={f'SH_hand{slot}_{f}_{j}' for f in ['thumb','index','middle','ring','little'] for j in range(3)}
   self.assertTrue(expected <= names);self.assertEqual(len(names),17)
 def test_embedded_pngs(self):
  for d,b in self.items.values():
   for image in d.get('images',[]):
    v=d['bufferViews'][image['bufferView']];self.assertEqual(b[v['byteOffset']:v['byteOffset']+8],b'\x89PNG\r\n\x1a\n')
 def test_total_triangles(self):
  total=sum(d['accessors'][p['indices']]['count']//3 for d,b in self.items.values() for m in d['meshes'] for p in m['primitives'])
  self.assertEqual(total,1020)
if __name__=='__main__':unittest.main(verbosity=2)
