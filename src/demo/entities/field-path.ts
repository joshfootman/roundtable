import { BitReader } from './bit-reader.ts'
type Node = { weight: number; value: number } & (
  | { kind: 'leaf' }
  | { kind: 'branch'; left: Node; right: Node }
)
enum FieldPathOperation {
  PlusOne = 0,
  PlusTwo = 1,
  PlusThree = 2,
  PlusFour = 3,
  PlusN = 4,
  PushOneLeftDeltaZeroRightZero = 5,
  PushOneLeftDeltaZeroRightNonZero = 6,
  PushOneLeftDeltaOneRightZero = 7,
  PushOneLeftDeltaOneRightNonZero = 8,
  PushOneLeftDeltaNRightZero = 9,
  PushOneLeftDeltaNRightNonZero = 10,
  PushOneLeftDeltaNRightNonZeroPack6Bits = 11,
  PushOneLeftDeltaNRightNonZeroPack8Bits = 12,
  PushTwoLeftDeltaZero = 13,
  PushTwoPack5LeftDeltaZero = 14,
  PushThreeLeftDeltaZero = 15,
  PushThreePack5LeftDeltaZero = 16,
  PushTwoLeftDeltaOne = 17,
  PushTwoPack5LeftDeltaOne = 18,
  PushThreeLeftDeltaOne = 19,
  PushThreePack5LeftDeltaOne = 20,
  PushTwoLeftDeltaN = 21,
  PushTwoPack5LeftDeltaN = 22,
  PushThreeLeftDeltaN = 23,
  PushThreePack5LeftDeltaN = 24,
  PushN = 25,
  PushNAndNonTopological = 26,
  PopOnePlusOne = 27,
  PopOnePlusN = 28,
  PopAllButOnePlusOne = 29,
  PopAllButOnePlusN = 30,
  PopAllButOnePlusNPack3Bits = 31,
  PopAllButOnePlusNPack6Bits = 32,
  PopNPlusOne = 33,
  PopNPlusN = 34,
  PopNAndNonTopographical = 35,
  NonTopoComplex = 36,
  NonTopoPenultimatePlusOne = 37,
  NonTopoComplexPack4Bits = 38,
  FieldPathEncodeFinish = 39,
}
const weights = [
  36271, 10334, 1375, 646, 4128, 35, 3, 521, 2942, 560, 471, 10530, 251, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 310, 2, 0, 1837, 149, 300, 634, 0, 0, 1, 76, 271, 99, 25474,
]
function buildTree() {
  const nodes: Node[] = weights.map((weight, value) => ({
    kind: 'leaf',
    weight: Math.max(1, weight),
    value,
  }))
  let value = weights.length
  while (nodes.length > 1) {
    nodes.sort((a, b) => a.weight - b.weight || b.value - a.value)
    const left = nodes.shift()!
    const right = nodes.shift()!
    nodes.push({ kind: 'branch', weight: left.weight + right.weight, value: value++, left, right })
  }
  return nodes[0]!
}
const root = buildTree()
export function readFieldPaths(reader: BitReader): number[][] {
  const path = [-1, 0, 0, 0, 0, 0, 0]
  let last = 0
  let done = false
  const paths: number[][] = []
  function pop(count: number) {
    if (count > last) throw new Error('The demo contains an invalid entity field path.')
    while (count--) path[last--] = 0
  }
  while (!done) {
    let node = root
    while (node.kind === 'branch') node = reader.boolean() ? node.right : node.left
    switch (node.value) {
      case FieldPathOperation.PlusOne: {
        path[last]++
        break
      }
      case FieldPathOperation.PlusTwo: {
        path[last]! += 2
        break
      }
      case FieldPathOperation.PlusThree: {
        path[last]! += 3
        break
      }
      case FieldPathOperation.PlusFour: {
        path[last]! += 4
        break
      }
      case FieldPathOperation.PlusN: {
        path[last]! += reader.fieldVar() + 5
        break
      }
      case FieldPathOperation.PushOneLeftDeltaZeroRightZero: {
        last++
        path[last]! = 0
        break
      }
      case FieldPathOperation.PushOneLeftDeltaZeroRightNonZero: {
        last++
        path[last]! = reader.fieldVar()
        break
      }
      case FieldPathOperation.PushOneLeftDeltaOneRightZero: {
        path[last]++
        last++
        path[last]! = 0
        break
      }
      case FieldPathOperation.PushOneLeftDeltaOneRightNonZero: {
        path[last]++
        last++
        path[last]! = reader.fieldVar()
        break
      }
      case FieldPathOperation.PushOneLeftDeltaNRightZero: {
        path[last]! += reader.fieldVar()
        last++
        path[last]! = 0
        break
      }
      case FieldPathOperation.PushOneLeftDeltaNRightNonZero: {
        path[last]! += reader.fieldVar() + 2
        last++
        path[last]! = reader.fieldVar() + 1
        break
      }
      case FieldPathOperation.PushOneLeftDeltaNRightNonZeroPack6Bits: {
        path[last]! += reader.bits(3) + 2
        last++
        path[last]! = reader.bits(3) + 1
        break
      }
      case FieldPathOperation.PushOneLeftDeltaNRightNonZeroPack8Bits: {
        path[last]! += reader.bits(4) + 2
        last++
        path[last]! = reader.bits(4) + 1
        break
      }
      case FieldPathOperation.PushTwoLeftDeltaZero: {
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        break
      }
      case FieldPathOperation.PushTwoPack5LeftDeltaZero: {
        last++
        path[last]! = reader.bits(5)
        last++
        path[last]! = reader.bits(5)
        break
      }
      case FieldPathOperation.PushThreeLeftDeltaZero: {
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        break
      }
      case FieldPathOperation.PushThreePack5LeftDeltaZero: {
        last++
        path[last]! = reader.bits(5)
        last++
        path[last]! = reader.bits(5)
        last++
        path[last]! = reader.bits(5)
        break
      }
      case FieldPathOperation.PushTwoLeftDeltaOne: {
        path[last]++
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        break
      }
      case FieldPathOperation.PushTwoPack5LeftDeltaOne: {
        path[last]++
        last++
        path[last]! += reader.bits(5)
        last++
        path[last]! += reader.bits(5)
        break
      }
      case FieldPathOperation.PushThreeLeftDeltaOne: {
        path[last]++
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        break
      }
      case FieldPathOperation.PushThreePack5LeftDeltaOne: {
        path[last]++
        last++
        path[last]! += reader.bits(5)
        last++
        path[last]! += reader.bits(5)
        last++
        path[last]! += reader.bits(5)
        break
      }
      case FieldPathOperation.PushTwoLeftDeltaN: {
        path[last]! += reader.uBitVar() + 2
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        break
      }
      case FieldPathOperation.PushTwoPack5LeftDeltaN: {
        path[last]! += reader.uBitVar() + 2
        last++
        path[last]! += reader.bits(5)
        last++
        path[last]! += reader.bits(5)
        break
      }
      case FieldPathOperation.PushThreeLeftDeltaN: {
        path[last]! += reader.uBitVar() + 2
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        last++
        path[last]! += reader.fieldVar()
        break
      }
      case FieldPathOperation.PushThreePack5LeftDeltaN: {
        path[last]! += reader.uBitVar() + 2
        last++
        path[last]! += reader.bits(5)
        last++
        path[last]! += reader.bits(5)
        last++
        path[last]! += reader.bits(5)
        break
      }
      case FieldPathOperation.PushN: {
        const n = reader.uBitVar()
        path[last]! += reader.uBitVar()
        for (let i = 0; i < n; i++) {
          last++
          path[last]! += reader.fieldVar()
        }
        break
      }
      case FieldPathOperation.PushNAndNonTopological: {
        for (let i = 0; i <= last; i++) {
          if (reader.boolean()) {
            path[i]! += reader.varInt() + 1
          }
        }
        const count = reader.uBitVar()
        for (let i = 0; i < count; i++) {
          last++
          path[last]! = reader.fieldVar()
        }
        break
      }
      case FieldPathOperation.PopOnePlusOne: {
        pop(1)
        path[last]++
        break
      }
      case FieldPathOperation.PopOnePlusN: {
        pop(1)
        path[last]! += reader.fieldVar() + 1
        break
      }
      case FieldPathOperation.PopAllButOnePlusOne: {
        pop(last)
        path[0]++
        break
      }
      case FieldPathOperation.PopAllButOnePlusN: {
        pop(last)
        path[0]! += reader.fieldVar() + 1
        break
      }
      case FieldPathOperation.PopAllButOnePlusNPack3Bits: {
        pop(last)
        path[0]! += reader.bits(3) + 1
        break
      }
      case FieldPathOperation.PopAllButOnePlusNPack6Bits: {
        pop(last)
        path[0]! += reader.bits(6) + 1
        break
      }
      case FieldPathOperation.PopNPlusOne: {
        pop(reader.fieldVar())
        path[last]++
        break
      }
      case FieldPathOperation.PopNPlusN: {
        pop(reader.fieldVar())
        path[last]! += reader.varInt()
        break
      }
      case FieldPathOperation.PopNAndNonTopographical: {
        pop(reader.fieldVar())
        for (let i = 0; i <= last; i++) {
          if (reader.boolean()) {
            path[i]! += reader.varInt()
          }
        }
        break
      }
      case FieldPathOperation.NonTopoComplex: {
        for (let i = 0; i <= last; i++) {
          if (reader.boolean()) {
            path[i]! += reader.varInt()
          }
        }
        break
      }
      case FieldPathOperation.NonTopoPenultimatePlusOne: {
        path[last - 1]++
        break
      }
      case FieldPathOperation.NonTopoComplexPack4Bits: {
        for (let i = 0; i <= last; i++) {
          if (reader.boolean()) {
            path[i]! += reader.bits(4) - 7
          }
        }
        break
      }
      case FieldPathOperation.FieldPathEncodeFinish: {
        done = true
        break
      }
    }
    if (
      !done &&
      (last < 0 || last >= path.length || path.slice(0, last + 1).some((value) => value < 0))
    )
      throw new Error('The demo contains an invalid entity field path.')
    if (!done) paths.push(path.slice(0, last + 1))
  }
  return paths
}
