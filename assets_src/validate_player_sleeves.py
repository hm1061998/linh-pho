"""Validate sleeve deformation and actual arm movement from the exported GLB."""
import bpy
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene = bpy.data.scenes.new('Sleeve_validation')
bpy.context.window.scene = scene
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'public/assets/player_hero.glb'))
arm = next(o for o in scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in scene.objects if o.type == 'MESH')
for track in arm.animation_data.nla_tracks:
    track.mute = True
base = [mesh.matrix_world @ v.co for v in mesh.data.vertices]
edges = [tuple(e.vertices) for e in mesh.data.edges if all(abs(base[i].x) > .22 and .85 < base[i].z < 1.42 for i in e.vertices) and (base[e.vertices[0]] - base[e.vertices[1]]).length > .01]
report = {}
for clip in ['walk', 'run']:
    strip = next(t.strips[0] for t in arm.animation_data.nla_tracks if t.name == clip)
    arm.animation_data.action = strip.action
    arm.animation_data.action_slot = strip.action_slot
    ratios, swings, elbows = [], [], []
    for frame in range(int(strip.action.frame_range[1]) + 1):
        scene.frame_set(frame)
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        data = evaluated.to_mesh()
        positions = [evaluated.matrix_world @ v.co for v in data.vertices]
        ratios.extend((positions[i] - positions[j]).length / (base[i] - base[j]).length for i, j in edges)
        evaluated.to_mesh_clear()
        swings.append(arm.pose.bones['UpperArm.L'].rotation_quaternion.to_euler().x)
        elbows.append(arm.pose.bones['Forearm.L'].rotation_quaternion.angle)
    result = {'edgeCount': len(edges), 'maxStretch': max(ratios), 'p95Stretch': sorted(ratios)[int(len(ratios) * .95)], 'armSwingDegrees': math.degrees(max(swings) - min(swings)), 'maxElbowDegrees': math.degrees(max(elbows))}
    assert result['maxStretch'] < 2.1, (clip, result)
    assert result['p95Stretch'] < 1.15, (clip, result)
    assert result['armSwingDegrees'] > (45 if clip == 'walk' else 60), (clip, result)
    assert result['maxElbowDegrees'] < 30, (clip, result)
    report[clip] = result
with open(os.path.join(ROOT, 'assets_src/vendor/quaternius/sleeve_validation.json'), 'w') as output:
    json.dump(report, output, indent=2)
print(json.dumps(report, indent=2))
