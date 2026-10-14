"""Run in Blender: adapt the user-supplied GLBs, preserving their textures.

Rebuild after build_assets.py, which generates the original blockout assets.
No external assets or generators are used. Originals in docs/ are never modified.
"""
import bpy
import bmesh
import math
import os
import runpy
import sys
import numpy as np
from mathutils import Vector, Matrix, Quaternion

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
legacy = runpy.run_path(os.path.join(ROOT, 'assets_src', 'build_assets.py'))
NPC_SOURCES = [
    ('Ba_NGhiem', 'npc_ba_nghiem', 'NPC_BaNghiem'),
    ('Co_Lam', 'npc_co_lam', 'NPC_CoLam'),
    ('Ong_Do', 'npc_ong_do', 'NPC_OngDo'),
]


def source(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'docs', name + '.glb'))
    objects = list(set(bpy.data.objects) - before)
    obj = next(o for o in objects if o.type == 'MESH')
    obj.data.transform(obj.matrix_world)
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    # Supplied meshes face -Y in Blender; the game contract is +Y / glTF -Z.
    obj.data.transform(Matrix.Rotation(math.pi, 4, 'Z'))
    for other in objects:
        if other != obj:
            bpy.data.objects.remove(other, do_unlink=True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    obj.data.calc_loop_triangles()
    budget = {'Nhan_Vat': 5500, 'Dong_hanh': 4500, 'Den_Long': 2400, 'Ba_NGhiem': 6000, 'Co_Lam': 6000, 'Ong_Do': 6000}[name]
    dec = obj.modifiers.new('Game triangle budget', 'DECIMATE')
    dec.ratio = (budget - 100) / len(obj.data.loop_triangles)
    bpy.ops.object.modifier_apply(modifier=dec.name)
    obj.data.validate()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    for mat in obj.data.materials:
        mat.name = 'MAT_' + name
        if name == 'Den_Long':
            shader = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            shader.inputs['Emission Color'].default_value = (1, .38, .08, 1)
            shader.inputs['Emission Strength'].default_value = .12
        for node in mat.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                if max(node.image.size) > 1024:
                    node.image.scale(1024, 1024)
                node.image.pack()
    obj.hide_set(True)
    return obj


def fit(obj, size, pivot):
    coords = [v.co for v in obj.data.vertices]
    low = Vector([min(v[i] for v in coords) for i in range(3)])
    high = Vector([max(v[i] for v in coords) for i in range(3)])
    extent = high - low
    factors = Vector((size[0] / extent.x, size[2] / extent.y, size[1] / extent.z)) if size[0] else Vector((size[1] / extent.z,) * 3)
    centre = (low + high) / 2
    centre.z = low.z if pivot == 'floor' else high.z if pivot == 'hang' else centre.z
    for v in obj.data.vertices:
        v.co = Vector([(v.co[i] - centre[i]) * factors[i] for i in range(3)])
    obj.data.update()


def variant_material(obj, tint):
    if tint is None:
        return
    mat = obj.data.materials[0].copy()
    mat.name = 'MAT_' + obj.name + '_Atlas'
    obj.data.materials[0] = mat
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = bsdf.inputs['Base Color'].links[0].from_node
    img = tex.image.copy()
    img.name = 'TEX_' + obj.name
    pixels = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    # Recolour blue cloth only; retain skin, leather, face and lantern detail.
    blue = (pixels[:, 2] > pixels[:, 0] * 1.15) & (pixels[:, 2] > pixels[:, 1] * 1.04)
    luminance = pixels[blue, :3].max(axis=1)
    pixels[blue, :3] = luminance[:, None] * np.array(tint)
    img.pixels.foreach_set(pixels.ravel())
    img.pack()
    tex.image = img


def accessory(obj, kind):
    if not kind:
        return
    mat = bpy.data.materials.new('MAT_' + obj.name + '_Accessory')
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (0.10, 0.065, 0.04, 1)
    bsdf.inputs['Roughness'].default_value = 0.85
    if kind == 'scholar_hat':
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.19, radius2=0.13, depth=0.13, location=(0, 0.015, 1.68))
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.085, location=(0, -0.095, 1.58))
    extra = bpy.context.object
    extra.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    extra.select_set(True)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()


def human_rig(obj, node, walk):
    arm = legacy['_make_rig'](node)
    if walk:
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode='EDIT')
        for side, sign in [('L', 1), ('R', -1)]:
            thigh = arm.data.edit_bones['UpperLeg.' + side]
            thigh.head = (.13 * sign, 0, .83)
            thigh.tail = (.13 * sign, 0, .43)
            shin = arm.data.edit_bones.new('LowerLeg.' + side)
            shin.head, shin.tail = thigh.tail, (.13 * sign, 0, .10)
            shin.parent = thigh
            foot = arm.data.edit_bones.new('Foot.' + side)
            foot.head, foot.tail = shin.tail, (.13 * sign, .15, .06)
            foot.parent = shin
            upper = arm.data.edit_bones['UpperArm.' + side]
            upper.tail = (.29 * sign, 0, 1.12)
            forearm = arm.data.edit_bones.new('Forearm.' + side)
            forearm.head, forearm.tail = upper.tail, (.32 * sign, 0, .88)
            forearm.parent = upper
        bpy.ops.object.mode_set(mode='OBJECT')
    groups = {b.name: obj.vertex_groups.new(name=b.name) for b in arm.data.bones}
    def ramp(value, low, high):
        t = max(0, min(1, (value - low) / (high - low)))
        return t * t * (3 - 2 * t)
    for v in obj.data.vertices:
        x, y, z = v.co
        side = 'L' if x > 0 else 'R'
        if walk:
            weights = {}
            def add(bone, weight):
                weights[bone] = weights.get(bone, 0) + weight
            head = ramp(z, 1.43, 1.52)
            arm_weight = ramp(abs(x), .21, .29) * ramp(z, .77, .9) * (1 - head)
            leg_weight = (1 - ramp(z, .74, .89)) * (1 - arm_weight)
            add('Head', head)
            elbow = 1 - ramp(z, 1.07, 1.17)
            add('UpperArm.' + side, arm_weight * (1 - elbow))
            add('Forearm.' + side, arm_weight * elbow)
            left_weight = ramp(x, -.035, .035)
            for leg_side, side_weight in [('L', left_weight), ('R', 1 - left_weight)]:
                knee = 1 - ramp(z, .37, .49)
                ankle = 1 - ramp(z, .08, .16)
                add('UpperLeg.' + leg_side, leg_weight * side_weight * (1 - knee))
                add('LowerLeg.' + leg_side, leg_weight * side_weight * knee * (1 - ankle))
                add('Foot.' + leg_side, leg_weight * side_weight * knee * ankle)
            add('Spine', max(0, 1 - head - arm_weight - leg_weight))
            total = sum(weights.values())
            for bone, weight in weights.items():
                if weight > .0001:
                    groups[bone].add([v.index], weight / total, 'REPLACE')
            continue
        if z > 1.44:
            bone = 'Head'
        elif z < 0.83:
            bone = 'UpperLeg.' + side
        elif abs(x) > 0.23:
            bone = 'UpperArm.' + side
        else:
            bone = 'Spine'
        groups[bone].add([v.index], 1, 'REPLACE')
    mod = obj.modifiers.new('Character rig', 'ARMATURE')
    mod.object = arm
    obj.parent = arm
    idle = legacy['_idle_human'](arm)
    if walk:
        # Idle must explicitly release the planted walk's pelvis and leg pose.
        for frame in [1, 25, 48]:
            root = arm.pose.bones['Root']
            root.location = (0, 0, 0)
            root.keyframe_insert(data_path='location', frame=frame)
            for side in ['L', 'R']:
                for name in ['UpperLeg.', 'LowerLeg.', 'Foot.', 'Forearm.']:
                    pose = arm.pose.bones[name + side]
                    if name == 'Forearm.':
                        pose.rotation_mode = 'XYZ'
                        pose.rotation_euler = (0, 0, 0)
                        pose.keyframe_insert(data_path='rotation_euler', frame=frame)
                    else:
                        pose.rotation_mode = 'QUATERNION'
                        pose.rotation_quaternion = (1, 0, 0, 0)
                        pose.keyframe_insert(data_path='rotation_quaternion', frame=frame)
                        pose.location = (0, 0, 0)
                        pose.keyframe_insert(data_path='location', frame=frame)
    actions = [('idle', idle)]
    if walk:
        actions.append(('walk', smooth_walk(arm)))
    for name, action in actions:
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, action)
        track.mute = True
    arm.animation_data.action = None
    for bone in arm.pose.bones:
        bone.rotation_euler = (0, 0, 0)
        bone.rotation_quaternion = (1, 0, 0, 0)
        bone.location = (0, 0, 0)
    return arm


def smooth_walk(arm):
    """Bake a two-bone solved gait: 60% planted stance, 40% low foot swing.

    A planted foot travels backwards at 1.0667 m/s in model space. Runtime
    cadence matches this speed, cancelling forward entity travel during stance.
    """
    action = bpy.data.actions.new('Player_walk')
    arm.animation_data.action = action
    def smooth(t):
        return t * t * t * (10 - 15 * t + 6 * t * t)
    def orient(name, head, tail):
        bone = arm.data.bones[name]
        rest_direction = bone.tail_local - bone.head_local
        rotation = rest_direction.rotation_difference(tail - head) @ bone.matrix_local.to_quaternion()
        pose = arm.pose.bones[name]
        pose.rotation_mode = 'QUATERNION'
        pose.matrix = Matrix.LocRotScale(head, rotation, Vector((1, 1, 1)))
        bpy.context.view_layer.update()
        pose.keyframe_insert(data_path='rotation_quaternion', frame=frame)
        pose.keyframe_insert(data_path='location', frame=frame)
    # 48 intervals provide smooth contact/roll timing; still one second at 48 fps.
    # Scene/export remain 24 fps, so use half-frame keys and force sampling below.
    for sample in range(49):
        frame = 1 + sample / 2
        t = sample / 48
        phase = t * 2 * math.pi
        pelvis_height = .748 + .014 * math.sin(phase) ** 2
        root = arm.pose.bones['Root']
        root.location = (.012 * math.sin(phase), pelvis_height - .83, 0)
        root.keyframe_insert(data_path='location', frame=frame)
        bpy.context.view_layer.update()
        for side, sign, offset in [('L', 1, 0), ('R', -1, .5)]:
            cycle = (t + offset) % 1
            if cycle < .6:
                foot_y = .32 - .64 * cycle / .6
                lift = 0
            else:
                swing_t = (cycle - .6) / .4
                foot_y = -.32 + .64 * smooth(swing_t)
                lift = .085 * math.sin(math.pi * swing_t) ** 2
            hip = Vector((.13 * sign + root.location.x, 0, pelvis_height))
            ankle = Vector((.13 * sign, foot_y, .10 + lift))
            delta = ankle - hip
            distance = delta.length
            along = (.4 ** 2 - .33 ** 2 + distance ** 2) / (2 * distance)
            bend = math.sqrt(max(0, .4 ** 2 - along ** 2))
            forward = Vector((0, -delta.z, delta.y)).normalized()
            knee = hip + delta.normalized() * along + forward * bend
            orient('UpperLeg.' + side, hip, knee)
            orient('LowerLeg.' + side, knee, ankle)
            foot = arm.pose.bones['Foot.' + side]
            # Keep the sole flat through stance, with only a small toe-up swing.
            roll = math.radians(5) * (lift / .085)
            rotation = Quaternion((1, 0, 0), roll) @ arm.data.bones[foot.name].matrix_local.to_quaternion()
            foot.rotation_mode = 'QUATERNION'
            foot.matrix = Matrix.LocRotScale(ankle, rotation, Vector((1, 1, 1)))
            foot.keyframe_insert(data_path='rotation_quaternion', frame=frame)
            foot.keyframe_insert(data_path='location', frame=frame)
            arm_swing = math.cos(phase + offset * 2 * math.pi)
            for name, degrees in [('UpperArm.', -9 * arm_swing), ('Forearm.', -8 - 3 * arm_swing)]:
                pose = arm.pose.bones[name + side]
                pose.rotation_mode = 'XYZ'
                pose.rotation_euler.x = math.radians(degrees)
                pose.keyframe_insert(data_path='rotation_euler', frame=frame)
        spine = arm.pose.bones['Spine']
        spine.rotation_mode = 'XYZ'
        spine.rotation_euler = (math.radians(1.5), math.radians(1.5 * math.sin(phase)), math.radians(-1.5 * math.sin(phase)))
        spine.keyframe_insert(data_path='rotation_euler', frame=frame)
    return action


def build(template, stem, node, size, pivot='floor', tint=None, ornament=None, human=False, walk=False, spirit=False):
    obj = template.copy()
    obj.data = template.data.copy()
    bpy.context.scene.collection.objects.link(obj)
    obj.hide_set(False)
    obj.name = node + '_Mesh' if human else node
    fit(obj, size, pivot)
    variant_material(obj, tint)
    accessory(obj, ornament)
    if ornament:
        fit(obj, (None, 1.7, None), pivot)
    objects = [obj]
    if human:
        objects.append(human_rig(obj, node, walk))
    if spirit:
        arm = bpy.data.objects.new(node + '_Rig', bpy.data.armatures.new(node + '_RigData'))
        bpy.context.scene.collection.objects.link(arm)
        bpy.context.view_layer.objects.active = arm
        arm.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bone = arm.data.edit_bones.new('Spirit')
        bone.head = (0, 0, 0)
        bone.tail = (0, 0, .1)
        bpy.ops.object.mode_set(mode='OBJECT')
        group = obj.vertex_groups.new(name='Spirit')
        group.add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        obj.parent = arm
        mod = obj.modifiers.new('Companion sway', 'ARMATURE')
        mod.object = arm
        objects.append(arm)
        arm.animation_data_create()
        action = bpy.data.actions.new('Companion_idle')
        arm.animation_data.action = action
        pose = arm.pose.bones['Spirit']
        pose.rotation_mode = 'XYZ'
        for frame, phase in [(1, 0), (25, 1), (49, 0)]:
            pose.rotation_euler.z = math.radians(4 * phase)
            pose.keyframe_insert(data_path='rotation_euler', frame=frame)
        track = arm.animation_data.nla_tracks.new()
        track.name = 'idle'
        track.strips.new('idle', 1, action)
        track.mute = False
        arm.animation_data.action = None
        pose.rotation_euler.z = 0
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    formats = bpy.ops.export_scene.gltf.get_rna_type().properties['export_image_format'].enum_items
    image_format = next(item.identifier for item in formats if item.identifier == 'JPEG')
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, 'public', 'assets', stem + '.glb'), export_format='GLB', use_selection=True, use_active_scene=True, export_yup=True, export_animations=human or spirit, export_animation_mode='NLA_TRACKS', export_anim_slide_to_zero=True, export_image_format=image_format, export_jpeg_quality=85)
    asset_scene = bpy.data.scenes.new(node + '_Source')
    for o in objects:
        asset_scene.collection.objects.link(o)
    asset_scene.render.fps = 24
    asset_scene.frame_end = 49
    # Blender 5.2 can crash when libraries.write serializes a skinned scene.
    # Save a normal editable project copy instead, with the asset scene active.
    working_scene = bpy.context.window.scene
    bpy.context.window.scene = asset_scene
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'assets_src', stem + '.blend'), copy=True, compress=True)
    bpy.context.window.scene = working_scene
    obj.data.calc_loop_triangles()
    print(stem, 'triangles', len(obj.data.loop_triangles), 'size', tuple(round(v, 3) for v in obj.dimensions))
    for o in objects:
        for c in list(o.users_collection):
            if c == bpy.context.scene.collection:
                c.objects.unlink(o)
    return objects


def build_npcs():
    for filename, stem, node in NPC_SOURCES:
        template = source(filename)
        build(template, stem, node, (None, 1.7, None), human=True)


def main(npcs_only=False, player_only=False):
    scene = bpy.data.scenes.new('Supplied_models_game_ready')
    bpy.context.window.scene = scene
    scene.render.fps = 24
    if player_only:
        build(source('Nhan_Vat'), 'player_hero', 'PLAYER_Hero', (None, 1.7, None), human=True, walk=True)
        print('Player locomotion rebuilt')
        return
    if npcs_only:
        build_npcs()
        print('Three dedicated NPC models replaced')
        return
    human = source('Nhan_Vat')
    companion = source('Dong_hanh')
    lantern = source('Den_Long')
    build(human, 'player_hero', 'PLAYER_Hero', (None, 1.7, None), human=True, walk=True)
    build_npcs()
    build(companion, 'npc_bac', 'NPC_Bac', (None, .5, None), pivot='centre', spirit=True)
    build(lantern, 'item_wooden_lantern', 'ITEM_WoodenLantern', (None, .5, None))
    build(lantern, 'furniture_hanging_lamp', 'PROP_HangingLamp', (.5, .545, .5), pivot='hang')
    build(lantern, 'craft_engraving_lantern', 'CRAFT_EngravingLantern', (.36, .5, .36))
    for stem, node, extent in [('prop_lantern_workshop', 'PROP_Lantern_Workshop', .5), ('prop_lantern_gate', 'PROP_Lantern_Gate', .7)] + [(f'prop_stall_{i}_lantern', f'PROP_Stall_{i}_Lantern', .45) for i in range(1, 7)]:
        build(lantern, stem, node, (extent, extent, extent), pivot='centre')
    print('Supplied model adaptation complete')


if __name__ == '__main__':
    main(npcs_only='--npcs-only' in sys.argv, player_only='--player-only' in sys.argv)
