"""Render the exported game GLBs, rather than the pre-export meshes."""
import bpy
import os
import sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scene = bpy.context.scene
for obj in list(scene.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
npcs_only = '--npcs-only' in sys.argv
stems = ['npc_ba_nghiem', 'npc_co_lam', 'npc_ong_do'] if npcs_only else ['player_hero', 'npc_ba_nghiem', 'npc_co_lam', 'npc_ong_do', 'npc_bac', 'item_wooden_lantern']
for i, stem in enumerate(stems):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'public', 'assets', stem + '.glb'))
    objects = set(bpy.data.objects) - before
    for obj in objects:
        if obj.parent is None:
            obj.location.x += (i - (len(stems) - 1) / 2) * 1.1
            if stem == 'npc_bac':
                obj.location.z += .9
            if stem == 'item_wooden_lantern':
                obj.location.z += .6
    if stem == 'player_hero':
        arm = next(o for o in objects if o.type == 'ARMATURE')
        for track in arm.animation_data.nla_tracks:
            track.mute = track.name != 'walk'
scene.frame_set(7)
world = bpy.data.worlds.new('Preview world')
world.use_nodes = True
next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND').inputs[0].default_value = (.055, .065, .085, 1)
scene.world = world
bpy.ops.object.camera_add(location=(0, 10, 2.7) if npcs_only else (1.1, 10, 3.8))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, .9)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 4.2 if npcs_only else 7.5
scene.camera = camera
for location, energy, size in [((0, 4, 6), 1100, 7), ((-4, -2, 3), 850, 5)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    light.rotation_euler = (Vector((0, 0, .8)) - light.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.resolution_x = 1500
scene.render.resolution_y = 650
scene.render.resolution_percentage = 100
scene.render.filepath = os.path.join(ROOT, 'docs', 'npc_models_preview.png' if npcs_only else 'supplied_models_preview.png')
bpy.ops.render.render(write_still=True)
