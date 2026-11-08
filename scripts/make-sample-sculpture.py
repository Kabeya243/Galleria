# Test fixture: a small abstract sculpture (twisted torus knot on a
# disc base), exported as a self-contained GLB. Generated with:
#   blender --background --python scripts/make-sample-sculpture.py
# Used by scripts/test-new-features.mjs to prove a real GLB parses
# with the same GLTFLoader the gallery uses. Not shipped to visitors.
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)

# Twisted torus knot — an abstract sculpture form.
bpy.ops.mesh.primitive_torus_add(
    major_segments=64, minor_segments=16,
    major_radius=0.32, minor_radius=0.11,
    location=(0, 0, 0.85),
)
knot = bpy.context.active_object
knot.name = "SculptureKnot"
# Twist: rotate the knot so it reads as a standing form, not a flat ring.
knot.rotation_euler = (0.5, 0.3, 0.0)
mat = bpy.data.materials.new("Bronze")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.45, 0.28, 0.12, 1.0)
bsdf.inputs["Metallic"].default_value = 0.7
bsdf.inputs["Roughness"].default_value = 0.35
knot.data.materials.append(mat)

# Disc base, so the model has a clear floor (the gallery normalises
# the base to the pedestal top).
bpy.ops.mesh.primitive_cylinder_add(
    vertices=32, radius=0.28, depth=0.08, location=(0, 0, 0.04)
)
base = bpy.context.active_object
base.name = "SculptureBase"
mat2 = bpy.data.materials.new("Stone")
mat2.use_nodes = True
bsdf2 = mat2.node_tree.nodes["Principled BSDF"]
bsdf2.inputs["Base Color"].default_value = (0.75, 0.74, 0.72, 1.0)
bsdf2.inputs["Roughness"].default_value = 0.85
base.data.materials.append(mat2)

bpy.ops.export_scene.gltf(
    filepath="/home/hatch/workspace/galleria/scripts/fixtures/sample-sculpture.glb",
    export_format="GLB",
)
print("Exported sample-sculpture.glb")
