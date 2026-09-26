// Single source of truth for the Commish client: `node pinocchio/codama.mjs`
// renders pinocchio/clients/js. Keep it in step with pinocchio/src/lib.rs.
import {
  accountNode, constantPdaSeedNodeFromString, createFromRoot, errorNode, fieldDiscriminatorNode,
  fixedSizeTypeNode, bytesTypeNode, instructionAccountNode, instructionArgumentNode, instructionNode,
  numberTypeNode, numberValueNode, pdaLinkNode, pdaNode, programNode, publicKeyTypeNode,
  publicKeyValueNode, rootNode, structFieldTypeNode, structTypeNode, variablePdaSeedNode,
} from "codama";
import { renderVisitor } from "@codama/renderers-js";

const u8 = numberTypeNode("u8"), u16 = numberTypeNode("u16"), u64 = numberTypeNode("u64"), i64 = numberTypeNode("i64");
const pk = publicKeyTypeNode();
const hash = fixedSizeTypeNode(bytesTypeNode(), 32);
const TOKEN = publicKeyValueNode("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "tokenProgram");
const ATA = publicKeyValueNode("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL", "associatedTokenProgram");
const SYSTEM = publicKeyValueNode("11111111111111111111111111111111", "systemProgram");

const field = (name, type) => structFieldTypeNode({ name, type });
const tag = (n) => structFieldTypeNode({ name: "tag", type: u8, defaultValue: numberValueNode(n), defaultValueStrategy: "omitted" });
const arg = (name, type) => instructionArgumentNode({ name, type });
const a = (name, w, s, defaultValue) => instructionAccountNode({ name, isWritable: w, isSigner: s, defaultValue });
const ix = (n, name, docs, accounts, args = []) => instructionNode({
  name, docs: [docs], accounts,
  arguments: [instructionArgumentNode({ name: "discriminator", type: u8, defaultValue: numberValueNode(n), defaultValueStrategy: "omitted" }), ...args],
  discriminators: [fieldDiscriminatorNode("discriminator")],
});
const tp = a("tokenProgram", false, false, TOKEN), sys = a("systemProgram", false, false, SYSTEM), atap = a("associatedTokenProgram", false, false, ATA);

const program = programNode({
  name: "commish",
  publicKey: "F5ZfVzJ9i9bdu18sS3SHjitbvErKrS6XdBYU52Kc8ijW",
  version: "0.2.0",
  accounts: [
    accountNode({
      name: "campaign", size: 164, pda: pdaLinkNode("campaign"), discriminators: [fieldDiscriminatorNode("tag")],
      data: structTypeNode([tag(1), field("brand", pk), field("attestor", pk), field("mint", pk), field("id", u64),
        field("commissionBps", u16), field("holdSeconds", i64), field("reserved", u64), field("paid", u64),
        field("bump", u8), field("vault", pk)]),
    }),
    accountNode({
      name: "affiliate", size: 82, pda: pdaLinkNode("affiliate"), discriminators: [fieldDiscriminatorNode("tag")],
      data: structTypeNode([tag(2), field("campaign", pk), field("wallet", pk), field("pending", u64), field("earned", u64), field("bump", u8)]),
    }),
    accountNode({
      name: "commission", size: 155, pda: pdaLinkNode("commission"), discriminators: [fieldDiscriminatorNode("tag")],
      data: structTypeNode([tag(3), field("campaign", pk), field("affiliate", pk), field("payee", pk), field("orderHash", hash),
        field("orderAmount", u64), field("amount", u64), field("releaseAt", i64), field("status", u8), field("bump", u8)]),
    }),
  ],
  pdas: [
    pdaNode({ name: "campaign", seeds: [constantPdaSeedNodeFromString("utf8", "campaign"), variablePdaSeedNode("brand", pk), variablePdaSeedNode("id", u64)] }),
    pdaNode({ name: "vault", seeds: [constantPdaSeedNodeFromString("utf8", "vault"), variablePdaSeedNode("campaign", pk)] }),
    pdaNode({ name: "affiliate", seeds: [constantPdaSeedNodeFromString("utf8", "affiliate"), variablePdaSeedNode("campaign", pk), variablePdaSeedNode("wallet", pk)] }),
    pdaNode({ name: "commission", seeds: [constantPdaSeedNodeFromString("utf8", "commission"), variablePdaSeedNode("campaign", pk), variablePdaSeedNode("orderHash", hash)] }),
  ],
  instructions: [
    ix(0, "createCampaign", "Brand creates a campaign and its USDC vault.",
      [a("brand", true, true), a("mint", false, false), a("campaign", true, false), a("vault", true, false), tp, sys],
      [arg("id", u64), arg("commissionBps", u16), arg("holdSeconds", i64), arg("attestor", pk), arg("campaignBump", u8), arg("vaultBump", u8)]),
    ix(1, "joinCampaign", "Creator joins a campaign.",
      [a("wallet", true, true), a("campaign", false, false), a("affiliate", true, false), sys], [arg("affiliateBump", u8)]),
    ix(2, "recordSale", "Attestor records an order; the commission is reserved from the vault.",
      [a("attestor", true, true), a("campaign", true, false), a("vault", false, false), a("affiliate", true, false), a("commission", true, false), tp, sys],
      [arg("orderHash", hash), arg("orderAmount", u64)]),
    ix(3, "cancelCommission", "Refund: the commission is released back to the brand's free budget.",
      [a("attestor", false, true), a("campaign", true, false), a("commission", true, false), a("affiliate", true, false)]),
    ix(4, "release", "After the hold, anyone pays the commission to its payee.",
      [a("cranker", true, true), a("campaign", true, false), a("mint", false, false), a("vault", true, false), a("commission", true, false),
        a("affiliate", true, false), a("payee", false, false), a("payeeToken", true, false), tp, atap, sys]),
    ix(5, "withdraw", "Brand withdraws budget not reserved for creators.",
      [a("brand", true, true), a("campaign", false, false), a("mint", false, false), a("vault", true, false), a("brandToken", true, false), tp, atap, sys],
      [arg("amount", u64)]),
    ix(6, "sellCommission", "Early payout: the buyer pays the payee now and becomes the payee.",
      [a("seller", false, true), a("buyer", false, true), a("campaign", false, false), a("commission", true, false), a("affiliate", false, false),
        a("mint", false, false), a("buyerToken", true, false), a("sellerToken", true, false), tp],
      [arg("price", u64)]),
  ],
  errors: ["InvalidCommission", "InvalidHold", "WrongAttestor", "WrongBrand", "WrongAffiliate", "ZeroCommission",
    "InsufficientBudget", "NotPending", "StillHeld", "MathOverflow", "WrongAccount", "NotSeller"]
    .map((name, i) => errorNode({ name: name[0].toLowerCase() + name.slice(1), code: 6000 + i, message: name.replace(/([A-Z])/g, " $1").trim() })),
});

await createFromRoot(rootNode(program)).accept(renderVisitor("pinocchio/clients/js", { deleteFolderBeforeRendering: true }));
console.log("generated pinocchio/clients/js");

// The renderer writes a CommonJS package.json; the client is ESM.
import { readFileSync, writeFileSync } from "node:fs";
const pj = "pinocchio/clients/js/package.json", p = JSON.parse(readFileSync(pj, "utf8"));
Object.assign(p, { name: "@commish/client", type: "module" });
delete p.scripts;
writeFileSync(pj, JSON.stringify(p, null, 2) + "\n");
