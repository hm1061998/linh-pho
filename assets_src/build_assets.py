"""Builds the runtime models (.glb) and their source files (.blend) for Linh Phố.

This file is the source of truth for every generated model. Run it inside Blender, for example:

    import runpy
    ns = runpy.run_path(r"D:\\Works\\Linh Phố\\linh-pho\\assets_src\\build_assets.py", run_name="build_assets")
    print(ns["build"](["furniture.stool"]))

Conventions (docs/ASSET_MANIFEST.md):
- 1 Blender unit = 1 m. Blender is Z-up; the glTF exporter writes Y-up, so Blender Z becomes glTF Y,
  and Blender +Y (the model's front) becomes glTF -Z.
- Furniture: pivot at the middle of the floor (feet on z = 0), except the hanging lamp, whose pivot is its hang point.
- Hub pieces: pivot at the centre of the blockout box, so the GLB sits exactly where hubLayout.ts puts it.
- NPCs: humans stand on their feet (pivot at feet, y = 0); the spirit is centred on its pivot.
"""

import math
import os
from functools import partial

import bmesh
import bpy
from mathutils import Matrix, Vector

REPO = r"D:\Works\Linh Phố\linh-pho"
OUT_DIR = os.path.join(REPO, "public", "assets")
SRC_DIR = os.path.join(REPO, "assets_src")

# Named palette. Hex colours are sRGB; they are converted to linear for the shader inputs.
# (hex, roughness, emission hex or None, emission strength)
PALETTE = {
    "MAT_WoodWarm_A": ("#76513A", 0.7, None, 0.0),
    "MAT_WoodDark_A": ("#4A3324", 0.7, None, 0.0),
    "MAT_WoodLight_A": ("#8A6442", 0.65, None, 0.0),
    "MAT_Terracotta_A": ("#BC744E", 0.8, None, 0.0),
    "MAT_Paper_A": ("#E7D4AD", 0.9, None, 0.0),
    "MAT_PaperGlow_A": ("#E7D4AD", 0.9, "#F2B759", 0.6),
    "MAT_Bamboo_A": ("#A89A5C", 0.6, None, 0.0),
    "MAT_Ink_A": ("#2E2620", 0.9, None, 0.0),
    "MAT_LanternGlow_A": ("#F2B759", 0.4, "#F2B759", 1.0),
    "MAT_Skin_A": ("#E0B48F", 0.6, None, 0.0),
    "MAT_Hair_A": ("#2B2118", 0.5, None, 0.0),
    "MAT_Trousers_A": ("#3A3328", 0.8, None, 0.0),
    "MAT_Shoe_A": ("#2E2620", 0.6, None, 0.0),
    "MAT_Hat_A": ("#D9C08A", 0.8, None, 0.0),
    "MAT_Jade_A": ("#65D4BD", 0.3, "#65D4BD", 0.5),
    "MAT_Window_A": ("#1F2A44", 0.35, None, 0.0),
    "MAT_Lips_A": ("#8E4A4A", 0.6, None, 0.0),
    "MAT_Belt_A": ("#3A2A1E", 0.7, None, 0.0),
    "MAT_StoneDark_A": ("#6B5C47", 0.9, None, 0.0),
    "MAT_Hemp_A": ("#B89A5E", 0.8, None, 0.0),
    "MAT_Indigo_A": ("#3F5FA8", 0.6, None, 0.0),
    "MAT_Foliage_A": ("#3E6B4F", 0.9, None, 0.0),
}


def _srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def _hex_to_linear(hex_color: str) -> tuple[float, float, float, float]:
    r, g, b = (int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    return (_srgb_to_linear(r), _srgb_to_linear(g), _srgb_to_linear(b), 1.0)


def material(name: str) -> bpy.types.Material:
    """Returns the named palette material, creating it once. Shader nodes are looked up by type, not by name."""
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing
    hex_color, roughness, emission_hex, emission_strength = PALETTE[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = _hex_to_linear(hex_color)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    if emission_hex is not None:
        bsdf.inputs["Emission Color"].default_value = _hex_to_linear(emission_hex)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


class Shape:
    """Collects primitives into one mesh. Each primitive is tagged with one of the given material names."""

    def __init__(self, material_names: list[str]):
        self.bm = bmesh.new()
        self.materials = [material(name) for name in material_names]
        self.slot = {name: index for index, name in enumerate(material_names)}

    def _add(self, op, material_name: str, **kwargs) -> None:
        """Runs a bmesh primitive op and tags the faces it created with the material's slot."""
        before = set(self.bm.faces)
        op(self.bm, **kwargs)
        index = self.slot[material_name]
        for face in self.bm.faces:
            if face not in before:
                face.material_index = index

    def box(self, mat: str, center, size) -> None:
        matrix = Matrix.Translation(center) @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        self._add(bmesh.ops.create_cube, mat, size=1.0, matrix=matrix)

    def cylinder(self, mat: str, center, radius: float, depth: float, segments: int = 16, radius2=None) -> None:
        """A cylinder along Z, or a cone when radius2 differs from radius."""
        top = radius if radius2 is None else radius2
        self._add(
            bmesh.ops.create_cone,
            mat,
            cap_ends=True,
            cap_tris=False,
            segments=segments,
            radius1=radius,
            radius2=top,
            depth=depth,
            matrix=Matrix.Translation(center),
        )

    def sphere(self, mat: str, center, radius: float, scale=(1.0, 1.0, 1.0), u: int = 16, v: int = 8) -> None:
        matrix = Matrix.Translation(center) @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        self._add(bmesh.ops.create_uvsphere, mat, u_segments=u, v_segments=v, radius=radius, matrix=matrix)

    def hip_roof(self, mat: str, eaves_half, ridge_half: float, z_eaves: float, z_ridge: float) -> None:
        """A hip roof: a rectangle at the eaves and a ridge along X. eaves_half is (x, y); ridge_half is the ridge's half length."""
        bx, by = eaves_half
        b0 = self.bm.verts.new((-bx, -by, z_eaves))
        b1 = self.bm.verts.new((bx, -by, z_eaves))
        b2 = self.bm.verts.new((bx, by, z_eaves))
        b3 = self.bm.verts.new((-bx, by, z_eaves))
        r0 = self.bm.verts.new((-ridge_half, 0.0, z_ridge))
        r1 = self.bm.verts.new((ridge_half, 0.0, z_ridge))
        index = self.slot[mat]
        for vertices in ([b0, b1, r1, r0], [b2, b3, r0, r1], [b1, b2, r1], [b3, b0, r0]):
            face = self.bm.faces.new(vertices)
            face.material_index = index

    def finish(self, name: str) -> bpy.types.Object:
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces[:])
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mat in self.materials:
            mesh.materials.append(mat)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


# ---- Furniture (docs/ASSET_MANIFEST.md section 2) ---------------------------------------------------------------


def furniture_stool():
    shape = Shape(["MAT_WoodWarm_A"])
    wood = "MAT_WoodWarm_A"
    shape.box(wood, (0.0, 0.0, 0.42), (0.60, 0.60, 0.06))  # seat, top at 0.45
    for x in (-0.24, 0.24):
        for y in (-0.24, 0.24):
            shape.box(wood, (x, y, 0.195), (0.06, 0.06, 0.39))  # legs
    for y in (-0.24, 0.24):
        shape.box(wood, (0.0, y, 0.15), (0.48, 0.04, 0.04))  # stretchers along X
    for x in (-0.24, 0.24):
        shape.box(wood, (x, 0.0, 0.15), (0.04, 0.48, 0.04))  # stretchers along Y
    return [shape.finish("PROP_Stool")], []


def furniture_lantern_shelf():
    wood, dark, glow = "MAT_WoodWarm_A", "MAT_WoodDark_A", "MAT_LanternGlow_A"
    shape = Shape([wood, dark, glow])
    shape.box(dark, (-0.78, 0.0, 0.55), (0.04, 0.5, 1.1))  # side panels
    shape.box(dark, (0.78, 0.0, 0.55), (0.04, 0.5, 1.1))
    shape.box(dark, (0.0, -0.235, 0.55), (1.52, 0.03, 1.1))  # back panel
    for z in (0.02, 0.5, 1.08):  # shelves, 0.04 thick
        shape.box(wood, (0.0, 0.0, z), (1.6, 0.5, 0.04))
    middle_top = 0.5 + 0.02
    for x in (-0.5, 0.0, 0.5):
        shape.sphere(glow, (x, 0.0, middle_top + 0.09), 0.09, u=12, v=8)
    for x in (-0.4, 0.4):
        shape.sphere(glow, (x, 0.0, 0.04 + 0.1), 0.1, u=12, v=8)
    return [shape.finish("PROP_LanternShelf")], []


def furniture_bamboo_vase():
    bamboo, dark = "MAT_Bamboo_A", "MAT_WoodDark_A"
    shape = Shape([bamboo, dark])
    base_r, top_r, height = 0.2, 0.16, 0.9
    shape.cylinder(bamboo, (0.0, 0.0, height / 2), base_r, height, segments=16, radius2=top_r)  # body
    for z in (0.15, 0.4, 0.62, 0.84):  # bamboo nodes, slightly wider than the body
        body_r = base_r + (top_r - base_r) * (z / height)
        shape.cylinder(dark, (0.0, 0.0, z), body_r + 0.012, 0.03, segments=16)
    shape.cylinder(dark, (0.0, 0.0, 0.02), 0.25, 0.04, segments=16)  # foot, sets the 0.5 m width
    shape.cylinder(dark, (0.0, 0.0, 0.88), 0.165, 0.04, segments=16)  # mouth rim, top at 0.9
    return [shape.finish("PROP_BambooVase")], []


def furniture_paper_painting():
    dark, paper, ink = "MAT_WoodDark_A", "MAT_Paper_A", "MAT_Ink_A"
    shape = Shape([dark, paper, ink])
    shape.box(dark, (0.0, 0.0, 0.77), (1.0, 0.08, 0.06))  # frame, top bar
    shape.box(dark, (0.0, 0.0, 0.03), (1.0, 0.08, 0.06))  # bottom bar
    shape.box(dark, (-0.47, 0.0, 0.4), (0.06, 0.08, 0.68))  # left bar
    shape.box(dark, (0.47, 0.0, 0.4), (0.06, 0.08, 0.68))  # right bar
    shape.box(dark, (0.0, -0.035, 0.4), (1.0, 0.01, 0.8))  # backing board
    shape.box(paper, (0.0, 0.0, 0.4), (0.88, 0.01, 0.68))  # paper, front face toward +Y
    shape.box(ink, (0.0, 0.006, 0.45), (0.5, 0.004, 0.02))  # ink strokes
    shape.box(ink, (-0.2, 0.006, 0.3), (0.02, 0.004, 0.3))
    shape.box(ink, (0.25, 0.006, 0.6), (0.2, 0.004, 0.04))
    return [shape.finish("PROP_PaperPainting")], []


def furniture_hanging_lamp():
    # Origin is the hang point. The cord goes down from it, and the shade hangs below.
    dark, glow_paper, ink = "MAT_WoodDark_A", "MAT_PaperGlow_A", "MAT_Ink_A"
    shape = Shape([ink, dark, glow_paper])
    shape.cylinder(ink, (0.0, 0.0, -0.03), 0.006, 0.06, segments=8)  # cord
    shape.cylinder(dark, (0.0, 0.0, -0.075), 0.06, 0.03, segments=16)  # top cap
    shape.sphere(glow_paper, (0.0, 0.0, -0.3), 0.25, scale=(1.0, 1.0, 0.9), u=24, v=12)  # shade, 0.5 m across
    shape.cylinder(dark, (0.0, 0.0, -0.535), 0.05, 0.02, segments=16)  # bottom cap
    return [shape.finish("PROP_HangingLamp")], []


# ---- Hub pieces (docs/ASSET_MANIFEST.md section 3) --------------------------------------------------------------
# Each piece is built around its own centre. The game places it at the blockout position from hubLayout.ts.
# Blender sizes are glTF sizes with Y and Z swapped, because the hub layout is written in game (Y-up) coordinates.


# Windows stand 0.02 m proud of the long walls. The walls are 0.02 m thinner on each side to make room, so every piece
# still measures exactly the blockout size.


def hub_env_house_shop_body():
    shape = Shape(["MAT_Paper_A", "MAT_Window_A"])
    shape.box("MAT_Paper_A", (0.0, 0.0, 0.0), (8.0, 5.96, 4.0))
    for x in (-2.2, 2.2):  # both long faces; the door on the front stays clear between them
        for side in (1, -1):
            shape.box("MAT_Window_A", (x, side * 2.99, 0.2), (1.2, 0.02, 1.3))
    return [shape.finish("ENV_House_Shop_Body")], []


def hub_env_house_shop_roof():
    shape = Shape(["MAT_Terracotta_A"])
    shape.hip_roof("MAT_Terracotta_A", (4.6, 3.6), 2.4, -0.4, 0.4)
    return [shape.finish("ENV_House_Shop_Roof")], []


def hub_prop_signboard_shop():
    # A dark frame around a blank paper panel. The panel is 0.01 m behind the frame, so it reads as recessed.
    frame, paper = "MAT_WoodDark_A", "MAT_Paper_A"
    shape = Shape([frame, paper])
    shape.box(frame, (0.0, 0.0, 0.4), (4.0, 0.15, 0.1))  # top bar
    shape.box(frame, (0.0, 0.0, -0.4), (4.0, 0.15, 0.1))  # bottom bar
    shape.box(frame, (-1.95, 0.0, 0.0), (0.1, 0.15, 0.7))  # left bar
    shape.box(frame, (1.95, 0.0, 0.0), (0.1, 0.15, 0.7))  # right bar
    shape.box(paper, (0.0, 0.0, 0.0), (3.8, 0.13, 0.7))
    return [shape.finish("PROP_Signboard_Shop")], []


def hub_env_house_workshop_body():
    shape = Shape(["MAT_WoodLight_A", "MAT_Window_A"])
    shape.box("MAT_WoodLight_A", (0.0, 0.0, 0.0), (7.0, 5.96, 3.5))
    for x in (-2.0, 2.0):
        for side in (1, -1):
            shape.box("MAT_Window_A", (x, side * 2.99, 0.0), (1.0, 0.02, 1.1))
    return [shape.finish("ENV_House_Workshop_Body")], []


def hub_env_house_workshop_roof():
    shape = Shape(["MAT_Terracotta_A"])
    shape.hip_roof("MAT_Terracotta_A", (4.1, 3.4), 2.6, -0.35, 0.35)
    return [shape.finish("ENV_House_Workshop_Roof")], []


def hub_prop_workbench_workshop():
    wood, dark = "MAT_WoodWarm_A", "MAT_WoodDark_A"
    shape = Shape([wood, dark])
    shape.box(wood, (0.0, 0.0, 0.46), (1.6, 1.0, 0.08))  # top, at 0.5 above the centre
    for x in (-0.76, 0.76):
        for y in (-0.46, 0.46):
            shape.box(dark, (x, y, -0.04), (0.08, 0.08, 0.92))  # legs
    return [shape.finish("PROP_Workbench_Workshop")], []


def hub_prop_lantern_workshop():
    shape = Shape(["MAT_LanternGlow_A"])
    shape.sphere("MAT_LanternGlow_A", (0.0, 0.0, 0.0), 0.25, u=16, v=12)
    return [shape.finish("PROP_Lantern_Workshop")], []


def hub_env_bridge_deck():
    # Planks alternate between two wood tones, so the deck reads as boards rather than one slab.
    shape = Shape(["MAT_WoodWarm_A", "MAT_WoodLight_A"])
    planks, width, gap = 10, 0.202, 0.02  # 10 planks across 2.2 m, with 0.02 m gaps
    for i in range(planks):
        x = -1.1 + width / 2 + i * (width + gap)
        mat = "MAT_WoodWarm_A" if i % 2 == 0 else "MAT_WoodLight_A"
        shape.box(mat, (x, 0.0, 0.0), (width, 8.4, 0.25))
    return [shape.finish("ENV_Bridge_Deck")], []


# ---- NPCs (docs/ASSET_MANIFEST.md section 4) --------------------------------------------------------------------
# Humans are rigged with a few bones. Each body part is one mesh with a single vertex group, so it moves rigidly
# with its bone. That is enough for the idle breathing and head nod. The spirit has no rig: its idle is on the object.

# (bone, head, tail, parent). Shared by all humans. The feet are at y = 0 (z in Blender) and the model faces +Y.
HUMAN_BONES = [
    ("Root", (0.0, 0.0, 0.0), (0.0, 0.0, 0.12), None),
    ("Spine", (0.0, 0.0, 0.85), (0.0, 0.0, 1.45), "Root"),
    ("Head", (0.0, 0.0, 1.45), (0.0, 0.0, 1.75), "Spine"),
    ("UpperArm.L", (0.27, 0.0, 1.42), (0.27, 0.0, 0.92), "Spine"),
    ("UpperArm.R", (-0.27, 0.0, 1.42), (-0.27, 0.0, 0.92), "Spine"),
    ("UpperLeg.L", (0.1, 0.0, 0.85), (0.1, 0.0, 0.08), "Root"),
    ("UpperLeg.R", (-0.1, 0.0, 0.85), (-0.1, 0.0, 0.08), "Root"),
]


def _make_rig(node: str) -> bpy.types.Object:
    data = bpy.data.armatures.new(node + "_Rig")
    arm = bpy.data.objects.new(node, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.select_all(action="DESELECT")
    arm.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail, parent in HUMAN_BONES:
        bone = data.edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        if parent is not None:
            bone.parent = data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


def _idle_human(arm: bpy.types.Object) -> bpy.types.Action:
    """A two-second loop (48 frames at 24 fps): the chest rises, the head nods, and the arms sway slightly."""
    arm.animation_data_create()
    action = bpy.data.actions.new("idle")
    arm.animation_data.action = action
    for frame, phase in ((1, 0.0), (25, 1.0), (48, 0.0)):
        for bone, degrees in (("Spine", 1.5), ("Head", -2.5), ("UpperArm.L", -2.0), ("UpperArm.R", 2.0)):
            pose = arm.pose.bones[bone]
            pose.rotation_mode = "XYZ"
            pose.rotation_euler = (math.radians(degrees * phase), 0.0, 0.0)
            pose.keyframe_insert(data_path="rotation_euler", frame=frame)
    return action


def _walk_human(arm: bpy.types.Object) -> bpy.types.Action:
    """A one-second walk loop (24 frames): the legs swing against each other, and the arms swing against the legs."""
    arm.animation_data_create()
    action = bpy.data.actions.new("walk")
    arm.animation_data.action = action
    for frame, phase in ((1, 0.0), (7, 1.0), (13, 0.0), (19, -1.0), (25, 0.0)):
        for bone, degrees in (("UpperLeg.L", 25.0), ("UpperLeg.R", -25.0), ("UpperArm.L", -18.0), ("UpperArm.R", 18.0)):
            pose = arm.pose.bones[bone]
            pose.rotation_mode = "XYZ"
            pose.rotation_euler = (math.radians(degrees * phase), 0.0, 0.0)
            pose.keyframe_insert(data_path="rotation_euler", frame=frame)
    return action


def _human(node: str, tunic_hex: str, *, long_tunic: bool, hair: str, hat: bool = False, beard: bool = False, head_z: float = 1.605, with_walk: bool = False):
    """A stylised person, 1.70 m to the top of the head (1.70 m with the hat), feet on y = 0."""
    tunic = "MAT_Tunic_" + node
    PALETTE[tunic] = (tunic_hex, 0.8, None, 0.0)
    arm = _make_rig(node)
    parts = []

    def add(label: str, bone: str, materials: list[str], build) -> None:
        shape = Shape(materials)
        build(shape)
        obj = shape.finish(f"{node}_{label}")
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
        modifier = obj.modifiers.new("Armature", "ARMATURE")
        modifier.object = arm
        obj.parent = arm
        parts.append(obj)

    hem = 0.42 if long_tunic else 0.85
    add("Tunic", "Spine", [tunic], lambda s: s.cylinder(tunic, (0.0, 0.0, (hem + 1.48) / 2), 0.2 + (0.04 if long_tunic else 0.0), 1.48 - hem, segments=16, radius2=0.18))
    # A belt just proud of the tunic at waist height. The tunic's radius there is about 0.195 m short, 0.207 m long.
    belt_r = 0.213 if long_tunic else 0.2
    add("Belt", "Spine", ["MAT_Belt_A"], lambda s: s.cylinder("MAT_Belt_A", (0.0, 0.0, 1.0), belt_r, 0.04, segments=16))
    add("Neck", "Head", ["MAT_Skin_A"], lambda s: s.cylinder("MAT_Skin_A", (0.0, 0.0, 1.5), 0.045, 0.1, segments=10))
    add("Head", "Head", ["MAT_Skin_A"], lambda s: s.sphere("MAT_Skin_A", (0.0, 0.0, head_z), 0.095, scale=(1.0, 1.0, 1.0), u=16, v=10))
    # Face on the front (+Y) of the head: two dark eyes and a small mouth, all just proud of the skin.
    add("Eyes", "Head", ["MAT_Ink_A"], lambda s: [s.sphere("MAT_Ink_A", (x, 0.088, head_z + 0.012), 0.013, u=8, v=6) for x in (-0.032, 0.032)])
    add("Mouth", "Head", ["MAT_Lips_A"], lambda s: s.box("MAT_Lips_A", (0.0, 0.09, head_z - 0.035), (0.03, 0.01, 0.008)))
    if hair == "bun":
        add("Hair", "Head", ["MAT_Hair_A"], lambda s: (s.sphere("MAT_Hair_A", (0.0, 0.0, head_z), 0.096, scale=(1.0, 1.0, 0.7), u=16, v=10), s.sphere("MAT_Hair_A", (0.0, -0.085, head_z + 0.03), 0.05, u=12, v=8)))
    elif hair == "long":
        add("Hair", "Head", ["MAT_Hair_A"], lambda s: (s.sphere("MAT_Hair_A", (0.0, 0.0, head_z), 0.096, scale=(1.0, 1.0, 0.75), u=16, v=10), s.cylinder("MAT_Hair_A", (0.0, -0.05, head_z - 0.12), 0.09, 0.26, segments=12)))
    else:
        add("Hair", "Head", ["MAT_Hair_A"], lambda s: s.sphere("MAT_Hair_A", (0.0, 0.0, head_z), 0.096, scale=(1.0, 1.0, 0.75), u=16, v=10))
    if beard:
        add("Beard", "Head", ["MAT_Hair_A"], lambda s: s.sphere("MAT_Hair_A", (0.0, 0.05, head_z - 0.07), 0.035, scale=(1.0, 0.8, 1.2), u=10, v=6))
    if hat:
        add("Hat", "Head", ["MAT_Hat_A"], lambda s: s.cylinder("MAT_Hat_A", (0.0, 0.0, head_z + 0.135), 0.34, 0.12, segments=20, radius2=0.06))
    for side in (1, -1):
        x = 0.27 * side
        add("Sleeve", "UpperArm.L" if side > 0 else "UpperArm.R", [tunic], lambda s, x=x: s.cylinder(tunic, (x, 0.0, 1.25), 0.055, 0.34, segments=10))
        add("Forearm", "UpperArm.L" if side > 0 else "UpperArm.R", ["MAT_Skin_A"], lambda s, x=x: s.cylinder("MAT_Skin_A", (x, 0.0, 1.0), 0.045, 0.16, segments=10))
        add("Hand", "UpperArm.L" if side > 0 else "UpperArm.R", ["MAT_Skin_A"], lambda s, x=x: s.sphere("MAT_Skin_A", (x, 0.0, 0.9), 0.05, u=10, v=6))
        leg = 0.1 * side
        add("Leg", "UpperLeg.L" if side > 0 else "UpperLeg.R", ["MAT_Trousers_A"], lambda s, x=leg: s.cylinder("MAT_Trousers_A", (x, 0.0, 0.475), 0.07, 0.75, segments=12))
        add("Shoe", "UpperLeg.L" if side > 0 else "UpperLeg.R", ["MAT_Shoe_A"], lambda s, x=leg: s.box("MAT_Shoe_A", (x, 0.03, 0.03), (0.1, 0.2, 0.06)))
    actions = [_idle_human(arm)]
    if with_walk:
        actions.append(_walk_human(arm))
    return [arm, *parts], actions


def npc_ba_nghiem():
    return _human("NPC_BaNghiem", "#7A4E3A", long_tunic=True, hair="bun")


def npc_co_lam():
    return _human("NPC_CoLam", "#4F7C6E", long_tunic=False, hair="long")


def npc_ong_do():
    # The hat sits on the head, so the head is lower to keep the whole figure at 1.70 m.
    return _human("NPC_OngDo", "#5A6B8C", long_tunic=False, hair="short", hat=True, beard=True, head_z=1.505)


def player_hero():
    """The playable character (GDD E2, art bible BLENDER-P04): the same rig as the people, with idle and walk loops."""
    return _human("PLAYER_Hero", "#3E6B4F", long_tunic=False, hair="short", with_walk=True)


def npc_bac():
    """Bấc: a paper-like wisp with a glowing body, dark eyes and a short wick. Centred on its pivot, 0.36 m across."""
    shape = Shape(["MAT_PaperGlow_A", "MAT_Ink_A", "MAT_WoodDark_A", "MAT_Jade_A"])
    shape.sphere("MAT_PaperGlow_A", (0.0, 0.0, 0.0), 0.18, u=24, v=16)  # body
    for x in (-0.06, 0.06):
        shape.sphere("MAT_Ink_A", (x, 0.15, 0.03), 0.028, u=8, v=6)  # eyes, sunk slightly so they keep the 0.18 m depth symmetric
    shape.cylinder("MAT_WoodDark_A", (0.0, 0.0, 0.165), 0.03, 0.03, segments=8, radius2=0.005)  # wick
    shape.sphere("MAT_Jade_A", (-0.1, 0.12, 0.09), 0.02, u=8, v=6)  # teal highlight
    obj = shape.finish("NPC_Bac")
    obj.animation_data_create()
    action = bpy.data.actions.new("idle")
    obj.animation_data.action = action
    for frame, width, height, lift in ((1, 1.0, 1.0, 0.0), (24, 1.04, 0.93, 0.012), (48, 1.0, 1.0, 0.0)):
        obj.location = (0.0, 0.0, lift)
        obj.scale = (width, width, height)
        obj.keyframe_insert(data_path="location", frame=frame)
        obj.keyframe_insert(data_path="scale", frame=frame)
    obj.location = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)
    return [obj], [action]


# ---- Registry ---------------------------------------------------------------------------------------------------

ASSETS = {
    "furniture.stool": ("furniture_stool", furniture_stool),
    "furniture.lantern_shelf": ("furniture_lantern_shelf", furniture_lantern_shelf),
    "furniture.bamboo_vase": ("furniture_bamboo_vase", furniture_bamboo_vase),
    "furniture.paper_painting": ("furniture_paper_painting", furniture_paper_painting),
    "furniture.hanging_lamp": ("furniture_hanging_lamp", furniture_hanging_lamp),
    "hub.ENV_House_Shop_Body": ("env_house_shop_body", hub_env_house_shop_body),
    "hub.ENV_House_Shop_Roof": ("env_house_shop_roof", hub_env_house_shop_roof),
    "hub.PROP_Signboard_Shop": ("prop_signboard_shop", hub_prop_signboard_shop),
    "hub.ENV_House_Workshop_Body": ("env_house_workshop_body", hub_env_house_workshop_body),
    "hub.ENV_House_Workshop_Roof": ("env_house_workshop_roof", hub_env_house_workshop_roof),
    "hub.PROP_Workbench_Workshop": ("prop_workbench_workshop", hub_prop_workbench_workshop),
    "hub.PROP_Lantern_Workshop": ("prop_lantern_workshop", hub_prop_lantern_workshop),
    "hub.ENV_Bridge_Deck": ("env_bridge_deck", hub_env_bridge_deck),
    "npc.npc_ba_nghiem": ("npc_ba_nghiem", npc_ba_nghiem),
    "npc.npc_co_lam": ("npc_co_lam", npc_co_lam),
    "npc.npc_ong_do": ("npc_ong_do", npc_ong_do),
    "npc.npc_bac": ("npc_bac", npc_bac),
}


# ---- Hub detail beyond manifest section 3 (docs/ASSET_MANIFEST.md section 3b) ------------------------------------
# Same rules as section 3: each piece is one GLB built around its own centre, at the size in hubLayout.ts. The
# helpers take game sizes (x, y up, z) and convert them, because Blender is Z-up. The tests check the sizes.


def _game_box(name: str, mat: str, size):
    shape = Shape([mat])
    shape.box(mat, (0.0, 0.0, 0.0), (size[0], size[2], size[1]))
    return [shape.finish(name)], []


def _game_ellipsoid(name: str, mat: str, size):
    """A sphere of the given size. A radius of 0.5 scaled by the size gives exactly that size."""
    shape = Shape([mat])
    shape.sphere(mat, (0.0, 0.0, 0.0), 0.5, scale=(size[0], size[2], size[1]), u=16, v=10)
    return [shape.finish(name)], []


def _game_pole(name: str, mat: str, diameter: float, height: float):
    shape = Shape([mat])
    shape.cylinder(mat, (0.0, 0.0, 0.0), diameter / 2, height, segments=16)
    return [shape.finish(name)], []


def _stall_table(name: str):
    wood, cloth = "MAT_WoodWarm_A", "MAT_Terracotta_A"
    shape = Shape([wood, cloth])
    shape.box(wood, (0.0, 0.0, 0.41), (2.4, 1.2, 0.08))  # top, from z 0.37 to 0.45
    for x in (-1.05, 1.05):
        for y in (-0.52, 0.52):
            shape.box(wood, (x, y, -0.04), (0.1, 0.1, 0.82))  # legs, from z -0.45 to 0.37
    shape.box(cloth, (0.0, 0.58, 0.1), (2.2, 0.02, 0.55))  # cloth hanging on the front (+Y), inside the box
    return [shape.finish(name)], []


def _stall_canopy(name: str):
    # A striped awning: 14 strips across 2.8 m, alternating terracotta and paper. The strips fill the box exactly.
    cloth, paper = "MAT_Terracotta_A", "MAT_Paper_A"
    shape = Shape([cloth, paper])
    strips = 14
    width = 2.8 / strips
    for i in range(strips):
        x = -1.4 + width / 2 + i * width
        shape.box(cloth if i % 2 == 0 else paper, (x, 0.0, 0.0), (width, 1.8, 0.12))
    return [shape.finish(name)], []


def _hub_detail() -> dict:
    """Builders for the hub pieces beyond section 3, keyed by blockout id."""
    detail = {}
    for i in range(1, 5):
        stall = f"PROP_Stall_{i}"
        detail[f"{stall}_Table"] = partial(_stall_table, f"{stall}_Table")
        detail[f"{stall}_Canopy"] = partial(_stall_canopy, f"{stall}_Canopy")
        for side in ("PostWest", "PostEast"):
            detail[f"{stall}_{side}"] = partial(_game_box, f"{stall}_{side}", "MAT_WoodDark_A", (0.12, 2.5, 0.12))
        detail[f"{stall}_Lantern"] = partial(_game_ellipsoid, f"{stall}_Lantern", "MAT_LanternGlow_A", (0.45, 0.45, 0.45))
    for compass in ("NE", "NW", "SE", "SW"):
        lamp = f"PROP_Lamp_Corner_{compass}"
        detail[f"{lamp}_Pole"] = partial(_game_pole, f"{lamp}_Pole", "MAT_WoodDark_A", 0.18, 2.8)
        detail[f"{lamp}_Head"] = partial(_game_ellipsoid, f"{lamp}_Head", "MAT_LanternGlow_A", (0.36, 0.36, 0.36))
    detail["PROP_Lamp_Plaza_Base"] = partial(_game_box, "PROP_Lamp_Plaza_Base", "MAT_StoneDark_A", (1.6, 0.5, 1.6))
    detail["PROP_Lamp_Plaza_Pole"] = partial(_game_pole, "PROP_Lamp_Plaza_Pole", "MAT_WoodDark_A", 0.35, 4.2)
    detail["PROP_Lamp_Plaza_Head"] = partial(_game_ellipsoid, "PROP_Lamp_Plaza_Head", "MAT_LanternGlow_A", (1.6, 1.6, 1.6))
    for side in ("West", "East"):
        name = f"ENV_Gate_Pillar_{side}"
        detail[name] = partial(_game_box, name, "MAT_WoodDark_A", (0.8, 4.5, 0.8))
    detail["ENV_Gate_Beam"] = partial(_game_box, "ENV_Gate_Beam", "MAT_Terracotta_A", (6.6, 0.6, 1.0))
    detail["PROP_Lantern_Gate"] = partial(_game_ellipsoid, "PROP_Lantern_Gate", "MAT_LanternGlow_A", (0.7, 0.7, 0.7))
    detail["ENV_House_Shop_Door"] = partial(_game_box, "ENV_House_Shop_Door", "MAT_WoodDark_A", (1.4, 2.4, 0.12))
    detail["ENV_Bush_East"] = partial(_game_ellipsoid, "ENV_Bush_East", "MAT_Foliage_A", (2.4, 1.6, 2.4))
    detail["ENV_Bush_West"] = partial(_game_ellipsoid, "ENV_Bush_West", "MAT_Foliage_A", (2.0, 1.4, 2.0))
    detail["ENV_Bush_North"] = partial(_game_ellipsoid, "ENV_Bush_North", "MAT_Foliage_A", (1.8, 1.2, 1.8))
    return detail


ASSETS.update({f"hub.{name}": (name.lower(), builder) for name, builder in _hub_detail().items()})


# ---- Craft models (GDD B5, art bible BLENDER-P03) ----------------------------------------------------------------
# The craft stage is built in the game's own coordinates (Y up). The three sockets sit on a circle of radius
# CRAFT_RING_M, at 0, 120 and 240 degrees from +X toward +Z. src/engine/craft/craftLayout.ts uses the same numbers.
CRAFT_RING_M = 0.18
CRAFT_SOCKET_ANGLES_DEG = (0.0, 120.0, 240.0)
CRAFT_BOTTOM_RING_Y = 0.14  # the top of the stand: the frame and the lantern start here
CRAFT_TOP_RING_Y = 0.56


def _craft_socket_blender(angle_deg: float, height: float, radius: float = CRAFT_RING_M):
    """A socket position in Blender coordinates: X stays X, game Z becomes -Y, and game Y becomes Z."""
    angle = math.radians(angle_deg)
    return (radius * math.cos(angle), -radius * math.sin(angle), height)


def _craft_stand(shape: Shape) -> None:
    """A round foot and a short pillar, so the piece stands on y = 0 and its top is CRAFT_BOTTOM_RING_Y."""
    shape.cylinder("MAT_WoodDark_A", (0.0, 0.0, 0.03), 0.18, 0.06, segments=24)  # foot, y 0 to 0.06
    shape.cylinder("MAT_WoodDark_A", (0.0, 0.0, 0.10), 0.04, 0.08, segments=12)  # pillar, y 0.06 to 0.14


def craft_lantern_frame():
    """The frame the player fills with three bamboo ribs. Its three sockets are the slots the ribs slide into."""
    shape = Shape(["MAT_WoodDark_A", "MAT_Bamboo_A"])
    _craft_stand(shape)
    shape.cylinder("MAT_Bamboo_A", (0.0, 0.0, 0.15), CRAFT_RING_M, 0.02, segments=8)  # bottom ring, y 0.14 to 0.16
    shape.cylinder("MAT_Bamboo_A", (0.0, 0.0, 0.55), CRAFT_RING_M, 0.02, segments=8)  # top ring, y 0.54 to 0.56
    for angle in CRAFT_SOCKET_ANGLES_DEG:
        # The slot sits just inside the ring, so the frame stays symmetric about its centre. The rib stands on its edge.
        x, y, _ = _craft_socket_blender(angle, 0.0, radius=CRAFT_RING_M - 0.03)
        shape.cylinder("MAT_WoodDark_A", (x, y, 0.165), 0.03, 0.01, segments=12)  # a dark slot on the bottom ring
    return [shape.finish("CRAFT_LanternFrame")], []


def craft_bamboo_rib():
    """One bamboo rib for the frame. Its origin is at its bottom, so it stands in a socket."""
    shape = Shape(["MAT_Bamboo_A"])
    shape.cylinder("MAT_Bamboo_A", (0.0, 0.0, 0.19), 0.018, 0.38, segments=10)
    return [shape.finish("CRAFT_BambooRib")], []


def craft_engraving_lantern():
    """The paper lantern the engraving marks go on. Its marks are drawn in the engine, on the ring at its middle."""
    shape = Shape(["MAT_WoodDark_A", "MAT_PaperGlow_A"])
    _craft_stand(shape)
    shape.sphere("MAT_PaperGlow_A", (0.0, 0.0, 0.32), 0.18, u=24, v=16)  # body, y 0.14 to 0.50
    return [shape.finish("CRAFT_EngravingLantern")], []


# ---- Pickups (GDD B4, E2) -----------------------------------------------------------------------------------------
# Each material fits inside the 0.32 m cube the game uses for a pickup, stands on the floor (pivot at the bottom),
# and is centred on x and y.


def pickup_bamboo():
    shape = Shape(["MAT_Bamboo_A", "MAT_Hemp_A"])
    for dx in (-0.03, 0.03):  # four poles, bundled symmetrically about the centre
        for dy in (-0.03, 0.03):
            shape.cylinder("MAT_Bamboo_A", (dx, dy, 0.15), 0.02, 0.30, segments=10)
    shape.cylinder("MAT_Hemp_A", (0.0, 0.0, 0.10), 0.05, 0.02, segments=12)  # a tie round the bundle
    return [shape.finish("PICKUP_Bamboo")], []


def pickup_paper():
    shape = Shape(["MAT_Paper_A", "MAT_Hemp_A"])
    shape.cylinder("MAT_Paper_A", (0.0, 0.0, 0.13), 0.08, 0.26, segments=16)  # a roll of dó paper
    shape.cylinder("MAT_Hemp_A", (0.0, 0.0, 0.13), 0.082, 0.02, segments=16)  # its band
    return [shape.finish("PICKUP_Paper")], []


def pickup_rope():
    shape = Shape(["MAT_Hemp_A"])
    for z in (0.025, 0.085, 0.145):  # three turns of a coil
        shape.cylinder("MAT_Hemp_A", (0.0, 0.0, z), 0.11, 0.05, segments=16)
    return [shape.finish("PICKUP_Rope")], []


def pickup_ink():
    shape = Shape(["MAT_Ink_A", "MAT_WoodDark_A"])
    shape.box("MAT_Ink_A", (0.0, 0.0, 0.08), (0.14, 0.14, 0.16))  # the stone body
    shape.box("MAT_Ink_A", (0.0, 0.0, 0.195), (0.05, 0.05, 0.07))  # the neck
    shape.box("MAT_WoodDark_A", (0.0, 0.0, 0.24), (0.07, 0.07, 0.03))  # the cap
    return [shape.finish("PICKUP_Ink")], []


def pickup_indigo():
    shape = Shape(["MAT_Indigo_A", "MAT_WoodDark_A"])
    shape.cylinder("MAT_Indigo_A", (0.0, 0.0, 0.09), 0.10, 0.18, segments=16)  # the jar
    shape.cylinder("MAT_WoodDark_A", (0.0, 0.0, 0.195), 0.105, 0.03, segments=16)  # its lid
    return [shape.finish("PICKUP_Indigo")], []


def pickup_wood_scrap():
    shape = Shape(["MAT_WoodLight_A", "MAT_WoodDark_A"])
    # Three scraps crossed over the centre, so the pile is symmetric. The bottom one sits on the floor.
    shape.box("MAT_WoodLight_A", (0.0, 0.0, 0.025), (0.20, 0.06, 0.05))
    shape.box("MAT_WoodDark_A", (0.0, 0.0, 0.075), (0.06, 0.20, 0.05))
    shape.box("MAT_WoodLight_A", (0.0, 0.0, 0.125), (0.12, 0.05, 0.05))
    return [shape.finish("PICKUP_WoodScrap")], []


ASSETS.update(
    {
        "pickup.bamboo": ("pickup_bamboo", pickup_bamboo),
        "pickup.paper": ("pickup_paper", pickup_paper),
        "pickup.rope": ("pickup_rope", pickup_rope),
        "pickup.ink": ("pickup_ink", pickup_ink),
        "pickup.indigo": ("pickup_indigo", pickup_indigo),
        "pickup.wood_scrap": ("pickup_wood_scrap", pickup_wood_scrap),
    }
)

ASSETS.update(
    {
        "craft.lantern_frame": ("craft_lantern_frame", craft_lantern_frame),
        "craft.bamboo_rib": ("craft_bamboo_rib", craft_bamboo_rib),
        "craft.engraving_lantern": ("craft_engraving_lantern", craft_engraving_lantern),
        "player.hero": ("player_hero", player_hero),
    }
)


def _gltf_extent(objects) -> str:
    """Overall size in glTF axes: X = Blender X, Y = Blender Z, Z = -Blender Y."""
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    xs = [p.x for p in points]
    ys = [p.z for p in points]
    zs = [-p.y for p in points]
    return (
        f"w {max(xs) - min(xs):.3f} h {max(ys) - min(ys):.3f} d {max(zs) - min(zs):.3f}"
        f" | y {min(ys):.3f}..{max(ys):.3f} z {min(zs):.3f}..{max(zs):.3f}"
    )


def _triangles(objects) -> int:
    total = 0
    for obj in objects:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            total += len(obj.data.loop_triangles)
    return total


def _export(stem: str, objects, actions) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(SRC_DIR, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT_DIR, stem + ".glb"),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_animations=bool(actions),
        export_skins=True,
    )
    blocks = set(objects) | set(actions)
    for obj in objects:
        if obj.data is not None:
            blocks.add(obj.data)
        if obj.type == "MESH":
            blocks.update(obj.data.materials)
    bpy.data.libraries.write(os.path.join(SRC_DIR, stem + ".blend"), blocks, fake_user=True)


def _cleanup(objects, actions) -> None:
    data = [obj.data for obj in objects if obj.type in ("MESH", "ARMATURE")]
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in data:
        if block.users == 0:
            if isinstance(block, bpy.types.Mesh):
                bpy.data.meshes.remove(block)
            else:
                bpy.data.armatures.remove(block)
    for action in actions:
        bpy.data.actions.remove(action)


def build(asset_ids: list[str], keep: bool = False) -> str:
    """Builds, exports and saves the source of each id. Returns one report line per asset."""
    lines = []
    for asset_id in asset_ids:
        stem, builder = ASSETS[asset_id]
        objects, actions = builder()
        _export(stem, objects, actions)
        lines.append(f"{asset_id} -> {stem}.glb | tris {_triangles(objects)} | {_gltf_extent(objects)}")
        if not keep:
            _cleanup(objects, actions)
    return "\n".join(lines)
