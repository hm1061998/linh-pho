"""Bake CC0 Quaternius Standard idle/walk onto the supplied player rig.

Run after adapt_supplied_models.py; preserves the player's mesh and textures.
"""
import bpy
import glob
import json
import math
import os
import runpy
import numpy as np
from mathutils import Matrix, Vector, Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = glob.glob(os.path.join(ROOT, 'assets_src/vendor/quaternius/standard/*/Unreal-Godot/UAL1_Standard.glb'))[0]
bpy.ops.wm.open_mainfile(filepath=os.path.join(ROOT, 'assets_src/player_hero.blend'))
scene = bpy.context.scene
scene.render.fps = 24
target = next(o for o in scene.objects if o.type == 'ARMATURE')
mesh = next(o for o in scene.objects if o.type == 'MESH')
target.animation_data.action = None
for track in list(target.animation_data.nla_tracks):
    target.animation_data.nla_tracks.remove(track)
for bone in target.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.objects.active = target
bpy.ops.object.mode_set(mode='EDIT')
if 'Pelvis' not in target.data.edit_bones:
    pelvis_bone = target.data.edit_bones.new('Pelvis')
    pelvis_bone.head, pelvis_bone.tail = (0, 0, .83), (0, 0, .9)
    pelvis_bone.parent = target.data.edit_bones['Root']
    for name in ['Spine', 'UpperLeg.L', 'UpperLeg.R']:
        target.data.edit_bones[name].parent = pelvis_bone
for side in ['L', 'R']:
    knee = target.data.edit_bones['UpperLeg.' + side].tail.copy()
    knee.z = .477
    target.data.edit_bones['UpperLeg.' + side].tail = knee
    target.data.edit_bones['LowerLeg.' + side].head = knee
bpy.ops.object.mode_set(mode='OBJECT')
for vertex in mesh.data.vertices:
    # The supplied mesh merges the backpack into the body. Spatial arm weights
    # otherwise stretch its rear leather panels whenever the elbows swing.
    if vertex.co.y < -.10 and .80 < vertex.co.z < 1.35 and (abs(vertex.co.x) < .22 or vertex.co.z < 1.18):
        spine = mesh.vertex_groups['Spine']
        movable = [(entry.group, entry.weight) for entry in vertex.groups if mesh.vertex_groups[entry.group].name.startswith(('UpperArm.', 'Forearm.', 'UpperLeg.', 'LowerLeg.', 'Foot.'))]
        existing = next((entry.weight for entry in vertex.groups if entry.group == spine.index), 0)
        transfer = sum(weight for _, weight in movable)
        for group_index, _ in movable:
            mesh.vertex_groups[group_index].remove([vertex.index])
        if transfer > 0:
            spine.add([vertex.index], existing + transfer, 'REPLACE')
    arm_influence = sum(entry.weight for entry in vertex.groups if mesh.vertex_groups[entry.group].name.startswith(('UpperArm.', 'Forearm.')))
    if abs(vertex.co.x) > .20 and vertex.co.y > -.11 and .86 < vertex.co.z < 1.32 and arm_influence > .05:
        # The loose cuff is a sleeve, not a bridge to the torso. Give its whole
        # cross-section consistent arm weights; only blend around the elbow.
        for group_index in [entry.group for entry in vertex.groups]:
            mesh.vertex_groups[group_index].remove([vertex.index])
        side = 'L' if vertex.co.x > 0 else 'R'
        blend = max(0, min(1, (vertex.co.z - 1.07) / .12))
        blend = blend * blend * (3 - 2 * blend)
        mesh.vertex_groups['UpperArm.' + side].add([vertex.index], blend, 'REPLACE')
        mesh.vertex_groups['Forearm.' + side].add([vertex.index], 1 - blend, 'REPLACE')
    for side in ['L', 'R']:
        upper = mesh.vertex_groups['UpperLeg.' + side]
        lower = mesh.vertex_groups['LowerLeg.' + side]
        weights = {entry.group: entry.weight for entry in vertex.groups}
        total = weights.get(upper.index, 0) + weights.get(lower.index, 0)
        if total > 0:
            blend = max(0, min(1, (vertex.co.z - .417) / .12))
            blend = blend * blend * (3 - 2 * blend)
            upper.add([vertex.index], total * blend, 'REPLACE')
            lower.add([vertex.index], total * (1 - blend), 'REPLACE')
# Smooth sleeve transitions over connected topology, welding UV seam copies.
# Hard spatial assignments can pull adjacent cloth vertices in opposite directions.
weights = np.zeros((len(mesh.data.vertices), len(mesh.vertex_groups)), dtype=np.float32)
for vertex in mesh.data.vertices:
    for entry in vertex.groups:
        weights[vertex.index, entry.group] = entry.weight
neighbours = [set() for _ in mesh.data.vertices]
for edge in mesh.data.edges:
    i, j = edge.vertices
    neighbours[i].add(j)
    neighbours[j].add(i)
welds = {}
for vertex in mesh.data.vertices:
    welds.setdefault(tuple(round(value, 5) for value in vertex.co), []).append(vertex.index)
for indices in welds.values():
    for index in indices:
        neighbours[index].update(other for other in indices if other != index)
rows, columns = [], []
for index, adjacent in enumerate(neighbours):
    for other in adjacent:
        rows.append(index)
        columns.append(other)
rows, columns = np.array(rows), np.array(columns)
counts = np.maximum(1, np.bincount(rows, minlength=len(weights)))[:, None]
mask = np.array([abs(v.co.x) > .17 and .78 < v.co.z < 1.46 for v in mesh.data.vertices])
for _ in range(160):
    average = np.zeros_like(weights)
    np.add.at(average, rows, weights[columns])
    average /= counts
    weights[mask] = .5 * weights[mask] + .5 * average[mask]
weights /= np.maximum(weights.sum(axis=1, keepdims=True), 1e-8)
for vertex in mesh.data.vertices:
    if mask[vertex.index]:
        for group in mesh.vertex_groups:
            group.remove([vertex.index])
        for group_index, weight in enumerate(weights[vertex.index]):
            if weight > .0001:
                mesh.vertex_groups[group_index].add([vertex.index], float(weight), 'REPLACE')
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=SOURCE)
donor_objects = set(bpy.data.objects) - before
donor = next(o for o in donor_objects if o.type == 'ARMATURE')
clips = {track.name: (track.strips[0].action, track.strips[0].action_slot) for track in donor.animation_data.nla_tracks}
for track in donor.animation_data.nla_tracks:
    track.mute = True
mapping = {'Root': 'root', 'Pelvis': 'pelvis', 'Spine': 'spine_03', 'Head': 'Head'}
# Donor faces -Y; rotate it to the game's +Y convention, swapping lateral sides.
for side, donor_side in [('L', 'r'), ('R', 'l')]:
    for target_name, donor_name in [('UpperLeg', 'thigh'), ('LowerLeg', 'calf'), ('Foot', 'foot'), ('UpperArm', 'upperarm'), ('Forearm', 'lowerarm')]:
        mapping[target_name + '.' + side] = donor_name + '_' + donor_side
facing = Matrix.Rotation(math.pi, 4, 'Z')
donor.animation_data.action, donor.animation_data.action_slot = clips['Idle_Loop']
scene.frame_set(0)
reference = {}
for name, donor_name in mapping.items():
    rest = facing @ donor.matrix_world @ donor.data.bones[donor_name].matrix_local
    reference[name] = rest.to_quaternion()
    if name.startswith(('UpperArm', 'Forearm')):
        donor_direction = (facing.to_3x3() @ (donor.data.bones[donor_name].tail_local - donor.data.bones[donor_name].head_local)).normalized()
        target_direction = (target.data.bones[name].tail_local - target.data.bones[name].head_local).normalized()
        reference[name] = donor_direction.rotation_difference(target_direction) @ reference[name]
pelvis_reference = (facing @ donor.matrix_world @ donor.data.bones['pelvis'].matrix_local).translation.copy()
leg_scale = .73 / (donor.data.bones['thigh_l'].length + donor.data.bones['calf_l'].length)
actions = []
report = {}
for exported, source_name in [('idle', 'Idle_Loop'), ('walk', 'Walk_Loop'), ('run', 'Jog_Fwd_Loop')]:
    donor_action, slot = clips[source_name]
    donor.animation_data.action = donor_action
    donor.animation_data.action_slot = slot
    action = bpy.data.actions.new('Quaternius_' + exported)
    target.animation_data.action = action
    duration_frames = float(donor_action.frame_range[1])
    end = math.ceil(duration_frames)
    first = None
    grounding = []
    for frame in range(end + 1):
        # Resample fractional source lengths onto whole baked frames so the GLB
        # exporter includes the closing pose instead of stopping before it.
        sample_frame = frame * duration_frames / end
        scene.frame_set(int(sample_frame), subframe=sample_frame % 1)
        for bone in target.pose.bones:
            bone.matrix_basis = Matrix.Identity(4)
        bpy.context.view_layer.update()
        pelvis = (facing @ donor.matrix_world @ donor.pose.bones['pelvis'].matrix).translation
        offset = (pelvis - pelvis_reference) * leg_scale
        # No accumulated horizontal root motion; donor supplies only weight shifting.
        for name, donor_name in mapping.items():
            pose = target.pose.bones[name]
            original = target.data.bones[name]
            donor_rotation = (facing @ donor.matrix_world @ donor.pose.bones[donor_name].matrix).to_quaternion()
            rotation = donor_rotation @ reference[name].inverted() @ original.matrix_local.to_quaternion()
            if exported == 'walk' and name in ['Pelvis', 'Spine', 'Head']:
                rotation = original.matrix_local.to_quaternion().slerp(rotation, .55 if name == 'Pelvis' else .35)
            if pose.parent:
                head = (pose.parent.matrix @ original.parent.matrix_local.inverted() @ original.matrix_local).translation
            else:
                head = original.head_local + offset
            pose.rotation_mode = 'QUATERNION'
            pose.matrix = Matrix.LocRotScale(head, rotation, Vector((1, 1, 1)))
            bpy.context.view_layer.update()
        # Ground the retargeted shoe soles; character and donor have different leg proportions.
        evaluated = mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
        data = evaluated.to_mesh()
        floor = min((evaluated.matrix_world @ v.co).z for v in data.vertices)
        evaluated.to_mesh_clear()
        correction = min(floor, 0) if exported == 'run' else floor
        # Jog contains an airborne phase; do not drag both raised feet to the floor.
        target.pose.bones['Root'].location.y -= correction
        grounding.append(correction)
        if frame == 0:
            first = {bone.name: bone.matrix_basis.copy() for bone in target.pose.bones}
        elif frame == end:
            for bone in target.pose.bones:
                bone.matrix_basis = first[bone.name]
        for bone in target.pose.bones:
            bone.keyframe_insert(data_path='rotation_quaternion', frame=frame)
            bone.keyframe_insert(data_path='location', frame=frame)
    target.animation_data.action = None
    track = target.animation_data.nla_tracks.new()
    track.name = exported
    track.strips.new(exported, 0, action)
    track.mute = True
    actions.append(action)
    report[exported] = {'sourceClip': source_name, 'frames': end + 1, 'durationSeconds': end / 24, 'sourceDurationSeconds': duration_frames / 24, 'groundCorrectionRange': [min(grounding), max(grounding)]}
for obj in donor_objects:
    bpy.data.objects.remove(obj, do_unlink=True)
for bone in target.pose.bones:
    bone.matrix_basis = Matrix.Identity(4)
scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
target.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active = target
formats = bpy.ops.export_scene.gltf.get_rna_type().properties['export_image_format'].enum_items
fmt = next(i.identifier for i in formats if i.identifier == 'JPEG')
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, 'public/assets/player_hero.glb'), export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_anim_slide_to_zero=True, export_image_format=fmt, export_jpeg_quality=85)
bpy.context.preferences.filepaths.save_version = 0
bpy.data.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'assets_src/player_hero.blend'), compress=True)
with open(os.path.join(ROOT, 'assets_src/vendor/quaternius/retarget_report.json'), 'w') as output:
    json.dump(report, output, indent=2)
print(json.dumps(report, indent=2))
runpy.run_path(os.path.join(ROOT, 'assets_src/validate_player_sleeves.py'), run_name='__main__')
