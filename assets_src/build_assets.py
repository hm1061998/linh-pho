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

    def frustum(self, mat: str, bottom_half, top_half, z_bottom: float, z_top: float) -> None:
        """A four-sided truncated pyramid, used for hip roofs. Half extents are (x, y)."""
        bx, by = bottom_half
        tx, ty = top_half
        low = [self.bm.verts.new(p) for p in ((-bx, -by, z_bottom), (bx, -by, z_bottom), (bx, by, z_bottom), (-bx, by, z_bottom))]
        high = [self.bm.verts.new(p) for p in ((-tx, -ty, z_top), (tx, -ty, z_top), (tx, ty, z_top), (-tx, ty, z_top))]
        faces = [low, high[::-1]]
        for i in range(4):
            j = (i + 1) % 4
            faces.append([low[i], low[j], high[j], high[i]])
        index = self.slot[mat]
        for vertices in faces:
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


def hub_env_house_shop_body():
    shape = Shape(["MAT_Paper_A"])
    shape.box("MAT_Paper_A", (0.0, 0.0, 0.0), (8.0, 6.0, 4.0))
    return [shape.finish("ENV_House_Shop_Body")], []


def hub_env_house_shop_roof():
    shape = Shape(["MAT_Terracotta_A"])
    shape.frustum("MAT_Terracotta_A", (4.6, 3.6), (3.2, 2.2), -0.4, 0.4)
    return [shape.finish("ENV_House_Shop_Roof")], []


def hub_prop_signboard_shop():
    shape = Shape(["MAT_Paper_A"])
    shape.box("MAT_Paper_A", (0.0, 0.0, 0.0), (4.0, 0.15, 0.9))
    return [shape.finish("PROP_Signboard_Shop")], []


def hub_env_house_workshop_body():
    shape = Shape(["MAT_WoodLight_A"])
    shape.box("MAT_WoodLight_A", (0.0, 0.0, 0.0), (7.0, 6.0, 3.5))
    return [shape.finish("ENV_House_Workshop_Body")], []


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
    shape = Shape(["MAT_WoodWarm_A"])
    planks, width, gap = 10, 0.202, 0.02  # 10 planks across 2.2 m, with 0.02 m gaps
    for i in range(planks):
        x = -1.1 + width / 2 + i * (width + gap)
        shape.box("MAT_WoodWarm_A", (x, 0.0, 0.0), (width, 8.4, 0.25))
    return [shape.finish("ENV_Bridge_Deck")], []


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
    "hub.PROP_Workbench_Workshop": ("prop_workbench_workshop", hub_prop_workbench_workshop),
    "hub.PROP_Lantern_Workshop": ("prop_lantern_workshop", hub_prop_lantern_workshop),
    "hub.ENV_Bridge_Deck": ("env_bridge_deck", hub_env_bridge_deck),
}


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
    meshes = {obj.data for obj in objects if obj.type == "MESH"}
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in meshes:
        bpy.data.meshes.remove(mesh)
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
