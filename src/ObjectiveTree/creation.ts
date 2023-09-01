import { getGoalTokens } from "../grammerExample"
import { Actor, Model, NodeType } from "./types"

const convertIstarType = ({ type }: { type: NodeType }) => {
    switch (type) {
        case 'istar.Goal':
            return 'goal'
        case 'istar.Task':
            return 'task'
        default:
            throw new Error('Invalid node type: ' + type)
    }
}

// const nodeChildren = (
//     actor: Actor,
//     id?: string
// ): [GoalTree[] | undefined, relationship] => {
//     if (!id) {
//         return [undefined, 'none']
//     }

//     // find related objects in the links array
//     const links = model.links.filter((link) => link.target === id)

//     // get the set of relations associated to the parent element
//     const relations = links.map((link) => {
//         switch (link.type) {
//             case 'istar.AndRefinementLink':
//                 return 'and'
//             case 'istar.OrRefinementLink':
//                 return 'or'
//             default:
//                 throw new Error(
//                     `[UNSUPPORTED LINK]: Please implement ${link.type} decoding`
//                 )
//         }
//     })

//     // assert all elements are equal
//     const allEqual = relations.every((v) => v === relations[0])
//     if (!allEqual) {
//         throw new Error(`
//             [INVALID MODEL]: You can't mix and/or relations
//         `)
//     }

//     // recursively find children nodes' children
//     const children: GoalTree[] = links
//         .map((link) => {
//             // from links find linked the linked nodes
//             const node = actor.nodes.find((item) => item.id === link.source)
//             if (!node) {
//                 return undefined
//             }

//             const [id, text, sequence] = nodeName(
//                 node.text,
//                 convertIstarType(node.type)
//             )

//             const [granChildren, relation] = nodeChildren(actor, node?.id)

//             return {
//                 ...node,
//                 identifier: id,
//                 text: text,
//                 component: node.customProperties.component || 'verifier',
//                 isRoot: node.customProperties.selected || false,
//                 children: arrangeChildren(granChildren || [], sequence),
//                 relation,
//                 type: convertIstarType(node.type)
//             }
//         })
//         // clean undefined children from the tree
//         .filter((child) => child !== undefined) as GoalTree[]

//     return [[...children], relations[0]]
// }

// const nodeToTree = (actor: Actor, node: Node) => {
//     const [children, relation] = nodeChildren(actor, node?.id)
//     const [id, text, sequence] = nodeName(
//         node.text,
//         convertIstarType(node.type)
//     )
//     return {
//         ...node,
//         relation,
//         identifier: id,
//         text,
//         isRoot: node.customProperties.selected || false,
//         component: node.customProperties.component || 'undefined',
//         children: arrangeChildren(children || [], sequence),
//         type: convertIstarType(node.type)
//     }
// }

export const convertToTree = ({ model }: { model: Model }) => {
    return model.actors
        .map((actor) => {
            // find root node
            const rootNode = actor.nodes.find(
                (item) => item.customProperties.selected
            )
            if (!rootNode) {
                return undefined
            }
            console.log(rootNode);
            console.log(JSON.stringify(rootNode));
            getGoalTokens(JSON.stringify(rootNode));
            // calc tree 
            // return nodeToTree(actor, rootNode)
        })
        // filter undefined trees (those without a root node)
        .filter((tree) => tree)
}