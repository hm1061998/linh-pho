"""Keep only each asset's active source scene in its .blend project."""
import bpy
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
stems = ['player_hero', 'npc_ba_nghiem', 'npc_co_lam', 'npc_ong_do', 'npc_bac', 'item_wooden_lantern', 'furniture_hanging_lamp', 'craft_engraving_lantern', 'prop_lantern_workshop', 'prop_lantern_gate'] + [f'prop_stall_{i}_lantern' for i in range(1, 7)]
if '--npcs-only' in sys.argv:
    stems = ['npc_ba_nghiem', 'npc_co_lam', 'npc_ong_do']
if '--player-only' in sys.argv:
    stems = ['player_hero']
for stem in stems:
    path = os.path.join(ROOT, 'assets_src', stem + '.blend')
    bpy.ops.wm.open_mainfile(filepath=path)
    keep = bpy.context.scene
    keep_objects = set(keep.objects)
    for scene in list(bpy.data.scenes):
        if scene != keep:
            bpy.data.scenes.remove(scene)
    for obj in list(bpy.data.objects):
        if obj not in keep_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
    print(stem, os.path.getsize(path))
