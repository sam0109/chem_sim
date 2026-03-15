// ==============================================================
// Marching Cubes isosurface extraction
//
// Extracts a triangulated isosurface from a 3D scalar field.
// Used to visualize orbital wavefunctions as 3D surfaces.
//
// Reference: Lorensen & Cline, "Marching Cubes: A High Resolution
//   3D Surface Construction Algorithm", SIGGRAPH 1987
// Lookup tables: Paul Bourke, "Polygonising a Scalar Field"
//   http://paulbourke.net/geometry/polygonise/
// ==============================================================

/** Output mesh data suitable for Three.js BufferGeometry */
export interface MarchingCubesMesh {
  /** Flat array of vertex positions [x0,y0,z0, x1,y1,z1, ...] */
  positions: Float32Array;
  /** Flat array of vertex normals [nx0,ny0,nz0, ...] */
  normals: Float32Array;
  /** Triangle indices */
  indices: Uint32Array;
}

/**
 * Edge table: for each of the 256 cube configurations, a 12-bit mask
 * indicating which edges are intersected by the isosurface.
 *
 * Source: Paul Bourke, "Polygonising a Scalar Field"
 */
// prettier-ignore
const EDGE_TABLE: readonly number[] = [
  0x000, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x099, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x033, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
  0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0x0aa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x066, 0x16f, 0x265, 0x36c,
  0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0x0ff, 0x3f5, 0x2fc,
  0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x055, 0x15c,
  0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0x0cc,
  0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
  0x0cc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
  0x15c, 0x055, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
  0x2fc, 0x3f5, 0x0ff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
  0x36c, 0x265, 0x16f, 0x066, 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
  0x4ac, 0x5a5, 0x6af, 0x7a6, 0x0aa, 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
  0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x033, 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
  0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x099, 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
  0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x000,
];

/**
 * Triangle table: for each of the 256 cube configurations, a list of
 * edge triples forming triangles. -1 terminates the list.
 * Each entry indexes into the 12 edges of the cube.
 *
 * Source: Paul Bourke, "Polygonising a Scalar Field"
 */
// prettier-ignore
const TRI_TABLE: readonly (readonly number[])[] = [
  [-1],
  [0,8,3,-1],
  [0,1,9,-1],
  [1,8,3,9,8,1,-1],
  [1,2,10,-1],
  [0,8,3,1,2,10,-1],
  [9,2,10,0,2,9,-1],
  [2,8,3,2,10,8,10,9,8,-1],
  [3,11,2,-1],
  [0,11,2,8,11,0,-1],
  [1,9,0,2,3,11,-1],
  [1,11,2,1,9,11,9,8,11,-1],
  [3,10,1,11,10,3,-1],
  [0,10,1,0,8,10,8,11,10,-1],
  [3,9,0,3,11,9,11,10,9,-1],
  [9,8,10,10,8,11,-1],
  [4,7,8,-1],
  [4,3,0,7,3,4,-1],
  [0,1,9,8,4,7,-1],
  [4,1,9,4,7,1,7,3,1,-1],
  [1,2,10,8,4,7,-1],
  [3,4,7,3,0,4,1,2,10,-1],
  [9,2,10,9,0,2,8,4,7,-1],
  [2,10,9,2,9,7,2,7,3,7,9,4,-1],
  [8,4,7,3,11,2,-1],
  [11,4,7,11,2,4,2,0,4,-1],
  [9,0,1,8,4,7,2,3,11,-1],
  [4,7,11,9,4,11,9,11,2,9,2,1,-1],
  [3,10,1,3,11,10,7,8,4,-1],
  [1,11,10,1,4,11,1,0,4,7,11,4,-1],
  [4,7,8,9,0,11,9,11,10,11,0,3,-1],
  [4,7,11,4,11,9,9,11,10,-1],
  [9,5,4,-1],
  [9,5,4,0,8,3,-1],
  [0,5,4,1,5,0,-1],
  [8,5,4,8,3,5,3,1,5,-1],
  [1,2,10,9,5,4,-1],
  [3,0,8,1,2,10,4,9,5,-1],
  [5,2,10,5,4,2,4,0,2,-1],
  [2,10,5,3,2,5,3,5,4,3,4,8,-1],
  [9,5,4,2,3,11,-1],
  [0,11,2,0,8,11,4,9,5,-1],
  [0,5,4,0,1,5,2,3,11,-1],
  [2,1,5,2,5,8,2,8,11,4,8,5,-1],
  [10,3,11,10,1,3,9,5,4,-1],
  [4,9,5,0,8,1,8,10,1,8,11,10,-1],
  [5,4,0,5,0,11,5,11,10,11,0,3,-1],
  [5,4,8,5,8,10,10,8,11,-1],
  [9,7,8,5,7,9,-1],
  [9,3,0,9,5,3,5,7,3,-1],
  [0,7,8,0,1,7,1,5,7,-1],
  [1,5,3,3,5,7,-1],
  [9,7,8,9,5,7,10,1,2,-1],
  [10,1,2,9,5,0,5,3,0,5,7,3,-1],
  [8,0,2,8,2,5,8,5,7,10,5,2,-1],
  [2,10,5,2,5,3,3,5,7,-1],
  [7,9,5,7,8,9,3,11,2,-1],
  [9,5,7,9,7,2,9,2,0,2,7,11,-1],
  [2,3,11,0,1,8,1,7,8,1,5,7,-1],
  [11,2,1,11,1,7,7,1,5,-1],
  [9,5,8,8,5,7,10,1,3,10,3,11,-1],
  [5,7,0,5,0,9,7,11,0,1,0,10,11,10,0,-1],
  [11,10,0,11,0,3,10,5,0,8,0,7,5,7,0,-1],
  [11,10,5,7,11,5,-1],
  [10,6,5,-1],
  [0,8,3,5,10,6,-1],
  [9,0,1,5,10,6,-1],
  [1,8,3,1,9,8,5,10,6,-1],
  [1,6,5,2,6,1,-1],
  [1,6,5,1,2,6,3,0,8,-1],
  [9,6,5,9,0,6,0,2,6,-1],
  [5,9,8,5,8,2,5,2,6,3,2,8,-1],
  [2,3,11,10,6,5,-1],
  [11,0,8,11,2,0,10,6,5,-1],
  [0,1,9,2,3,11,5,10,6,-1],
  [5,10,6,1,9,2,9,11,2,9,8,11,-1],
  [6,3,11,6,5,3,5,1,3,-1],
  [0,8,11,0,11,5,0,5,1,5,11,6,-1],
  [3,11,6,0,3,6,0,6,5,0,5,9,-1],
  [6,5,9,6,9,11,11,9,8,-1],
  [5,10,6,4,7,8,-1],
  [4,3,0,4,7,3,6,5,10,-1],
  [1,9,0,5,10,6,8,4,7,-1],
  [10,6,5,1,9,7,1,7,3,7,9,4,-1],
  [6,1,2,6,5,1,4,7,8,-1],
  [1,2,5,5,2,6,3,0,4,3,4,7,-1],
  [8,4,7,9,0,5,0,6,5,0,2,6,-1],
  [7,3,9,7,9,4,3,2,9,5,9,6,2,6,9,-1],
  [3,11,2,7,8,4,10,6,5,-1],
  [5,10,6,4,7,2,4,2,0,2,7,11,-1],
  [0,1,9,4,7,8,2,3,11,5,10,6,-1],
  [9,2,1,9,11,2,9,4,11,7,11,4,5,10,6,-1],
  [8,4,7,3,11,5,3,5,1,5,11,6,-1],
  [5,1,11,5,11,6,1,0,11,7,11,4,0,4,11,-1],
  [0,5,9,0,6,5,0,3,6,11,6,3,8,4,7,-1],
  [6,5,9,6,9,11,4,7,9,7,11,9,-1],
  [10,4,9,6,4,10,-1],
  [4,10,6,4,9,10,0,8,3,-1],
  [10,0,1,10,6,0,6,4,0,-1],
  [8,3,1,8,1,6,8,6,4,6,1,10,-1],
  [1,4,9,1,2,4,2,6,4,-1],
  [3,0,8,1,2,9,2,4,9,2,6,4,-1],
  [0,2,4,4,2,6,-1],
  [8,3,2,8,2,4,4,2,6,-1],
  [10,4,9,10,6,4,11,2,3,-1],
  [0,8,2,2,8,11,4,9,10,4,10,6,-1],
  [3,11,2,0,1,6,0,6,4,6,1,10,-1],
  [6,4,1,6,1,10,4,8,1,2,1,11,8,11,1,-1],
  [9,6,4,9,3,6,9,1,3,11,6,3,-1],
  [8,11,1,8,1,0,11,6,1,9,1,4,6,4,1,-1],
  [3,11,6,3,6,0,0,6,4,-1],
  [6,4,8,11,6,8,-1],
  [7,10,6,7,8,10,8,9,10,-1],
  [0,7,3,0,10,7,0,9,10,6,7,10,-1],
  [10,6,7,1,10,7,1,7,8,1,8,0,-1],
  [10,6,7,10,7,1,1,7,3,-1],
  [1,2,6,1,6,8,1,8,9,8,6,7,-1],
  [2,6,9,2,9,1,6,7,9,0,9,3,7,3,9,-1],
  [7,8,0,7,0,6,6,0,2,-1],
  [7,3,2,6,7,2,-1],
  [2,3,11,10,6,8,10,8,9,8,6,7,-1],
  [2,0,7,2,7,11,0,9,7,6,7,10,9,10,7,-1],
  [1,8,0,1,7,8,1,10,7,6,7,10,2,3,11,-1],
  [11,2,1,11,1,7,10,6,1,6,7,1,-1],
  [8,9,6,8,6,7,9,1,6,11,6,3,1,3,6,-1],
  [0,9,1,11,6,7,-1],
  [7,8,0,7,0,6,3,11,0,11,6,0,-1],
  [7,11,6,-1],
  [7,6,11,-1],
  [3,0,8,11,7,6,-1],
  [0,1,9,11,7,6,-1],
  [8,1,9,8,3,1,11,7,6,-1],
  [10,1,2,6,11,7,-1],
  [1,2,10,3,0,8,6,11,7,-1],
  [2,9,0,2,10,9,6,11,7,-1],
  [6,11,7,2,10,3,10,8,3,10,9,8,-1],
  [7,2,3,6,2,7,-1],
  [7,0,8,7,6,0,6,2,0,-1],
  [2,7,6,2,3,7,0,1,9,-1],
  [1,6,2,1,8,6,1,9,8,8,7,6,-1],
  [10,7,6,10,1,7,1,3,7,-1],
  [10,7,6,1,7,10,1,8,7,1,0,8,-1],
  [0,3,7,0,7,10,0,10,9,6,10,7,-1],
  [7,6,10,7,10,8,8,10,9,-1],
  [6,8,4,11,8,6,-1],
  [3,6,11,3,0,6,0,4,6,-1],
  [8,6,11,8,4,6,9,0,1,-1],
  [9,4,6,9,6,3,9,3,1,11,3,6,-1],
  [6,8,4,6,11,8,2,10,1,-1],
  [1,2,10,3,0,11,0,6,11,0,4,6,-1],
  [4,11,8,4,6,11,0,2,9,2,10,9,-1],
  [10,9,3,10,3,2,9,4,3,11,3,6,4,6,3,-1],
  [8,2,3,8,4,2,4,6,2,-1],
  [0,4,2,4,6,2,-1],
  [1,9,0,2,3,4,2,4,6,4,3,8,-1],
  [1,9,4,1,4,2,2,4,6,-1],
  [8,1,3,8,6,1,8,4,6,6,10,1,-1],
  [10,1,0,10,0,6,6,0,4,-1],
  [4,6,3,4,3,8,6,10,3,0,3,9,10,9,3,-1],
  [10,9,4,6,10,4,-1],
  [4,9,5,7,6,11,-1],
  [0,8,3,4,9,5,11,7,6,-1],
  [5,0,1,5,4,0,7,6,11,-1],
  [11,7,6,8,3,4,3,5,4,3,1,5,-1],
  [9,5,4,10,1,2,7,6,11,-1],
  [6,11,7,1,2,10,0,8,3,4,9,5,-1],
  [7,6,11,5,4,10,4,2,10,4,0,2,-1],
  [3,4,8,3,5,4,3,2,5,10,5,2,11,7,6,-1],
  [7,2,3,7,6,2,5,4,9,-1],
  [9,5,4,0,8,6,0,6,2,6,8,7,-1],
  [3,6,2,3,7,6,1,5,0,5,4,0,-1],
  [6,2,8,6,8,7,2,1,8,4,8,5,1,5,8,-1],
  [9,5,4,10,1,6,1,7,6,1,3,7,-1],
  [1,6,10,1,7,6,1,0,7,8,7,0,9,5,4,-1],
  [4,0,10,4,10,5,0,3,10,6,10,7,3,7,10,-1],
  [7,6,10,7,10,8,5,4,10,4,8,10,-1],
  [6,9,5,6,11,9,11,8,9,-1],
  [3,6,11,0,6,3,0,5,6,0,9,5,-1],
  [0,11,8,0,5,11,0,1,5,5,6,11,-1],
  [6,11,3,6,3,5,5,3,1,-1],
  [1,2,10,9,5,11,9,11,8,11,5,6,-1],
  [0,11,3,0,6,11,0,9,6,5,6,9,1,2,10,-1],
  [11,8,5,11,5,6,8,0,5,10,5,2,0,2,5,-1],
  [6,11,3,6,3,5,2,10,3,10,5,3,-1],
  [5,8,9,5,2,8,5,6,2,3,8,2,-1],
  [9,5,6,9,6,0,0,6,2,-1],
  [1,5,8,1,8,0,5,6,8,3,8,2,6,2,8,-1],
  [1,5,6,2,1,6,-1],
  [1,3,6,1,6,10,3,8,6,5,6,9,8,9,6,-1],
  [10,1,0,10,0,6,9,5,0,5,6,0,-1],
  [0,3,8,5,6,10,-1],
  [10,5,6,-1],
  [11,5,10,7,5,11,-1],
  [11,5,10,11,7,5,8,3,0,-1],
  [5,11,7,5,10,11,1,9,0,-1],
  [10,7,5,10,11,7,9,8,1,8,3,1,-1],
  [11,1,2,11,7,1,7,5,1,-1],
  [0,8,3,1,2,7,1,7,5,7,2,11,-1],
  [9,7,5,9,2,7,9,0,2,2,11,7,-1],
  [7,5,2,7,2,11,5,9,2,3,2,8,9,8,2,-1],
  [2,5,10,2,3,5,3,7,5,-1],
  [8,2,0,8,5,2,8,7,5,10,2,5,-1],
  [9,0,1,5,10,3,5,3,7,3,10,2,-1],
  [9,8,2,9,2,1,8,7,2,10,2,5,7,5,2,-1],
  [1,3,5,3,7,5,-1],
  [0,8,7,0,7,1,1,7,5,-1],
  [9,0,3,9,3,5,5,3,7,-1],
  [9,8,7,5,9,7,-1],
  [5,8,4,5,10,8,10,11,8,-1],
  [5,0,4,5,11,0,5,10,11,11,3,0,-1],
  [0,1,9,8,4,10,8,10,11,10,4,5,-1],
  [10,11,4,10,4,5,11,3,4,9,4,1,3,1,4,-1],
  [2,5,1,2,8,5,2,11,8,4,5,8,-1],
  [0,4,11,0,11,3,4,5,11,2,11,1,5,1,11,-1],
  [0,2,5,0,5,9,2,11,5,4,5,8,11,8,5,-1],
  [9,4,5,2,11,3,-1],
  [2,5,10,3,5,2,3,4,5,3,8,4,-1],
  [5,10,2,5,2,4,4,2,0,-1],
  [3,10,2,3,5,10,3,8,5,4,5,8,0,1,9,-1],
  [5,10,2,5,2,4,1,9,2,9,4,2,-1],
  [8,4,5,8,5,3,3,5,1,-1],
  [0,4,5,1,0,5,-1],
  [8,4,5,8,5,3,9,0,5,0,3,5,-1],
  [9,4,5,-1],
  [4,11,7,4,9,11,9,10,11,-1],
  [0,8,3,4,9,7,9,11,7,9,10,11,-1],
  [1,10,11,1,11,4,1,4,0,7,4,11,-1],
  [3,1,4,3,4,8,1,10,4,7,4,11,10,11,4,-1],
  [4,11,7,9,11,4,9,2,11,9,1,2,-1],
  [9,7,4,9,11,7,9,1,11,2,11,1,0,8,3,-1],
  [11,7,4,11,4,2,2,4,0,-1],
  [11,7,4,11,4,2,8,3,4,3,2,4,-1],
  [2,9,10,2,7,9,2,3,7,7,4,9,-1],
  [9,10,7,9,7,4,10,2,7,8,7,0,2,0,7,-1],
  [3,7,10,3,10,2,7,4,10,1,10,0,4,0,10,-1],
  [1,10,2,8,7,4,-1],
  [4,9,1,4,1,7,7,1,3,-1],
  [4,9,1,4,1,7,0,8,1,8,7,1,-1],
  [4,0,3,7,4,3,-1],
  [4,8,7,-1],
  [9,10,8,10,11,8,-1],
  [3,0,9,3,9,11,11,9,10,-1],
  [0,1,10,0,10,8,8,10,11,-1],
  [3,1,10,11,3,10,-1],
  [1,2,11,1,11,9,9,11,8,-1],
  [3,0,9,3,9,11,1,2,9,2,11,9,-1],
  [0,2,11,8,0,11,-1],
  [3,2,11,-1],
  [2,3,8,2,8,10,10,8,9,-1],
  [9,10,2,0,9,2,-1],
  [2,3,8,2,8,10,0,1,8,1,10,8,-1],
  [1,10,2,-1],
  [1,3,8,9,1,8,-1],
  [0,9,1,-1],
  [0,3,8,-1],
  [-1],
];

/**
 * Run marching cubes on a 3D scalar field.
 *
 * @param field - flat array of scalar values, indexed as [z * ny * nx + y * nx + x]
 * @param dims - grid dimensions [nx, ny, nz]
 * @param origin - world-space origin of the grid [x, y, z]
 * @param cellSize - size of each grid cell in world units
 * @param isovalue - isosurface threshold
 * @returns mesh data with positions, normals, and indices
 */
export function marchingCubes(
  field: Float32Array,
  dims: [number, number, number],
  origin: [number, number, number],
  cellSize: number,
  isovalue: number,
): MarchingCubesMesh {
  const [nx, ny, nz] = dims;
  const vertices: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Helper to get field value at grid coordinates
  const getVal = (ix: number, iy: number, iz: number): number =>
    field[iz * ny * nx + iy * nx + ix];

  // Helper to compute gradient (central differences for normal estimation)
  const getGradient = (
    ix: number,
    iy: number,
    iz: number,
  ): [number, number, number] => {
    const gx =
      (getVal(Math.min(ix + 1, nx - 1), iy, iz) -
        getVal(Math.max(ix - 1, 0), iy, iz)) /
      (2 * cellSize);
    const gy =
      (getVal(ix, Math.min(iy + 1, ny - 1), iz) -
        getVal(ix, Math.max(iy - 1, 0), iz)) /
      (2 * cellSize);
    const gz =
      (getVal(ix, iy, Math.min(iz + 1, nz - 1)) -
        getVal(ix, iy, Math.max(iz - 1, 0))) /
      (2 * cellSize);
    return [gx, gy, gz];
  };

  // Vertex interpolation along an edge
  const interpolateVertex = (
    x1: number,
    y1: number,
    z1: number,
    v1: number,
    x2: number,
    y2: number,
    z2: number,
    v2: number,
  ): [number, number, number] => {
    const dv = v2 - v1;
    // Avoid division by zero
    const t = Math.abs(dv) < 1e-10 ? 0.5 : (isovalue - v1) / dv;
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1), z1 + t * (z2 - z1)];
  };

  // Normal interpolation along an edge
  const interpolateNormal = (
    g1: [number, number, number],
    g2: [number, number, number],
    v1: number,
    v2: number,
  ): [number, number, number] => {
    const dv = v2 - v1;
    const t = Math.abs(dv) < 1e-10 ? 0.5 : (isovalue - v1) / dv;
    const nx = g1[0] + t * (g2[0] - g1[0]);
    const ny = g1[1] + t * (g2[1] - g1[1]);
    const nz = g1[2] + t * (g2[2] - g1[2]);
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (len < 1e-10) return [0, 1, 0];
    return [nx / len, ny / len, nz / len];
  };

  // Process each cube in the grid
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        // Get the 8 corner values of this cube
        const v0 = getVal(ix, iy, iz);
        const v1 = getVal(ix + 1, iy, iz);
        const v2 = getVal(ix + 1, iy + 1, iz);
        const v3 = getVal(ix, iy + 1, iz);
        const v4 = getVal(ix, iy, iz + 1);
        const v5 = getVal(ix + 1, iy, iz + 1);
        const v6 = getVal(ix + 1, iy + 1, iz + 1);
        const v7 = getVal(ix, iy + 1, iz + 1);

        // Build the cube index (which corners are inside the isosurface)
        let cubeIndex = 0;
        if (v0 >= isovalue) cubeIndex |= 1;
        if (v1 >= isovalue) cubeIndex |= 2;
        if (v2 >= isovalue) cubeIndex |= 4;
        if (v3 >= isovalue) cubeIndex |= 8;
        if (v4 >= isovalue) cubeIndex |= 16;
        if (v5 >= isovalue) cubeIndex |= 32;
        if (v6 >= isovalue) cubeIndex |= 64;
        if (v7 >= isovalue) cubeIndex |= 128;

        // Skip if cube is entirely inside or outside
        const edgeMask = EDGE_TABLE[cubeIndex];
        if (edgeMask === 0) continue;

        // World-space corner positions
        const x0 = origin[0] + ix * cellSize;
        const y0 = origin[1] + iy * cellSize;
        const z0 = origin[2] + iz * cellSize;
        const x1w = x0 + cellSize;
        const y1w = y0 + cellSize;
        const z1w = z0 + cellSize;

        // Compute edge vertices (12 edges)
        const edgeVerts: [number, number, number][] = new Array(12);
        const edgeNorms: [number, number, number][] = new Array(12);

        // Corner gradients (computed lazily)
        const g0 = getGradient(ix, iy, iz);
        const g1 = getGradient(ix + 1, iy, iz);
        const g2 = getGradient(ix + 1, iy + 1, iz);
        const g3 = getGradient(ix, iy + 1, iz);
        const g4 = getGradient(ix, iy, iz + 1);
        const g5 = getGradient(ix + 1, iy, iz + 1);
        const g6 = getGradient(ix + 1, iy + 1, iz + 1);
        const g7 = getGradient(ix, iy + 1, iz + 1);

        if (edgeMask & 1) {
          edgeVerts[0] = interpolateVertex(x0, y0, z0, v0, x1w, y0, z0, v1);
          edgeNorms[0] = interpolateNormal(g0, g1, v0, v1);
        }
        if (edgeMask & 2) {
          edgeVerts[1] = interpolateVertex(x1w, y0, z0, v1, x1w, y1w, z0, v2);
          edgeNorms[1] = interpolateNormal(g1, g2, v1, v2);
        }
        if (edgeMask & 4) {
          edgeVerts[2] = interpolateVertex(x1w, y1w, z0, v2, x0, y1w, z0, v3);
          edgeNorms[2] = interpolateNormal(g2, g3, v2, v3);
        }
        if (edgeMask & 8) {
          edgeVerts[3] = interpolateVertex(x0, y1w, z0, v3, x0, y0, z0, v0);
          edgeNorms[3] = interpolateNormal(g3, g0, v3, v0);
        }
        if (edgeMask & 16) {
          edgeVerts[4] = interpolateVertex(x0, y0, z1w, v4, x1w, y0, z1w, v5);
          edgeNorms[4] = interpolateNormal(g4, g5, v4, v5);
        }
        if (edgeMask & 32) {
          edgeVerts[5] = interpolateVertex(x1w, y0, z1w, v5, x1w, y1w, z1w, v6);
          edgeNorms[5] = interpolateNormal(g5, g6, v5, v6);
        }
        if (edgeMask & 64) {
          edgeVerts[6] = interpolateVertex(x1w, y1w, z1w, v6, x0, y1w, z1w, v7);
          edgeNorms[6] = interpolateNormal(g6, g7, v6, v7);
        }
        if (edgeMask & 128) {
          edgeVerts[7] = interpolateVertex(x0, y1w, z1w, v7, x0, y0, z1w, v4);
          edgeNorms[7] = interpolateNormal(g7, g4, v7, v4);
        }
        if (edgeMask & 256) {
          edgeVerts[8] = interpolateVertex(x0, y0, z0, v0, x0, y0, z1w, v4);
          edgeNorms[8] = interpolateNormal(g0, g4, v0, v4);
        }
        if (edgeMask & 512) {
          edgeVerts[9] = interpolateVertex(x1w, y0, z0, v1, x1w, y0, z1w, v5);
          edgeNorms[9] = interpolateNormal(g1, g5, v1, v5);
        }
        if (edgeMask & 1024) {
          edgeVerts[10] = interpolateVertex(
            x1w,
            y1w,
            z0,
            v2,
            x1w,
            y1w,
            z1w,
            v6,
          );
          edgeNorms[10] = interpolateNormal(g2, g6, v2, v6);
        }
        if (edgeMask & 2048) {
          edgeVerts[11] = interpolateVertex(x0, y1w, z0, v3, x0, y1w, z1w, v7);
          edgeNorms[11] = interpolateNormal(g3, g7, v3, v7);
        }

        // Emit triangles from the tri table
        const triRow = TRI_TABLE[cubeIndex];
        for (let t = 0; triRow[t] !== -1; t += 3) {
          const baseIdx = vertices.length / 3;

          for (let k = 0; k < 3; k++) {
            const edgeIdx = triRow[t + k];
            const v = edgeVerts[edgeIdx];
            const n = edgeNorms[edgeIdx];
            vertices.push(v[0], v[1], v[2]);
            normals.push(n[0], n[1], n[2]);
          }

          indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        }
      }
    }
  }

  return {
    positions: new Float32Array(vertices),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}
