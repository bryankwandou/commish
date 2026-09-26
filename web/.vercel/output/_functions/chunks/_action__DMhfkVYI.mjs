import { t as __exportAll } from "./rolldown-runtime_D7D4PA-g.mjs";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, MINT_SIZE, TOKEN_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, createInitializeMint2Instruction, createMintToInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync, unpackAccount } from "@solana/spl-token";
import { homedir } from "node:os";
import { createHash } from "crypto";
//#region ../pinocchio/client.ts
var PROGRAM_ID = new PublicKey("F5ZfVzJ9i9bdu18sS3SHjitbvErKrS6XdBYU52Kc8ijW");
var ERRORS = [
	"InvalidCommission",
	"InvalidHold",
	"WrongAttestor",
	"WrongBrand",
	"WrongAffiliate",
	"ZeroCommission",
	"InsufficientBudget",
	"NotPending",
	"StillHeld",
	"MathOverflow",
	"WrongAccount",
	"NotSeller"
];
/** "custom program error: 0x1777" → "StillHeld". */
var errorName = (e) => {
	const m = String(e).match(/custom program error: 0x([0-9a-f]+)/i);
	return m ? ERRORS[parseInt(m[1], 16) - 6e3] : void 0;
};
var orderHash = (id) => createHash("sha256").update(id).digest();
var u64 = (n) => {
	const b = Buffer.alloc(8);
	b.writeBigUInt64LE(BigInt(n));
	return b;
};
var campaignPdaBump = (brand, id) => PublicKey.findProgramAddressSync([
	Buffer.from("campaign"),
	brand.toBuffer(),
	u64(id)
], PROGRAM_ID);
var campaignPda = (brand, id) => campaignPdaBump(brand, id)[0];
var vaultPdaBump = (campaign) => PublicKey.findProgramAddressSync([Buffer.from("vault"), campaign.toBuffer()], PROGRAM_ID);
var affiliatePdaBump = (campaign, wallet) => PublicKey.findProgramAddressSync([
	Buffer.from("affiliate"),
	campaign.toBuffer(),
	wallet.toBuffer()
], PROGRAM_ID);
var affiliatePda = (campaign, wallet) => affiliatePdaBump(campaign, wallet)[0];
var commissionPda = (campaign, hash) => PublicKey.findProgramAddressSync([
	Buffer.from("commission"),
	campaign.toBuffer(),
	hash
], PROGRAM_ID)[0];
/** The campaign vault (a program-derived token account; `mint` kept for call-site symmetry). */
var vaultAta = (_mint, campaign) => vaultPdaBump(campaign)[0];
var ix = (keys, data) => new TransactionInstruction({
	programId: PROGRAM_ID,
	keys: keys.map(([pubkey, isSigner, isWritable]) => ({
		pubkey,
		isSigner,
		isWritable
	})),
	data
});
var TP = TOKEN_PROGRAM_ID;
var ATA = ASSOCIATED_TOKEN_PROGRAM_ID;
var SYS = SystemProgram.programId;
var createCampaign = (a) => {
	const [campaign, bump] = campaignPdaBump(a.brand, a.id);
	const [vault, vaultBump] = vaultPdaBump(campaign);
	const bps = Buffer.alloc(2);
	bps.writeUInt16LE(a.bps);
	const hold = Buffer.alloc(8);
	hold.writeBigInt64LE(BigInt(a.hold));
	return ix([
		[
			a.brand,
			true,
			true
		],
		[
			a.mint,
			false,
			false
		],
		[
			campaign,
			false,
			true
		],
		[
			vault,
			false,
			true
		],
		[
			TP,
			false,
			false
		],
		[
			SYS,
			false,
			false
		]
	], Buffer.concat([
		Buffer.from([0]),
		u64(a.id),
		bps,
		hold,
		a.attestor.toBuffer(),
		Buffer.from([bump, vaultBump])
	]));
};
var joinCampaign = (wallet, campaign) => ix([
	[
		wallet,
		true,
		true
	],
	[
		campaign,
		false,
		false
	],
	[
		affiliatePda(campaign, wallet),
		false,
		true
	],
	[
		SYS,
		false,
		false
	]
], Buffer.from([1, affiliatePdaBump(campaign, wallet)[1]]));
var recordSale = (a) => ix([
	[
		a.attestor,
		true,
		true
	],
	[
		a.campaign,
		false,
		true
	],
	[
		vaultAta(a.mint, a.campaign),
		false,
		false
	],
	[
		a.affiliate,
		false,
		true
	],
	[
		commissionPda(a.campaign, a.hash),
		false,
		true
	],
	[
		TP,
		false,
		false
	],
	[
		SYS,
		false,
		false
	]
], Buffer.concat([
	Buffer.from([2]),
	a.hash,
	u64(a.orderAmount)
]));
var cancelCommission = (a) => ix([
	[
		a.attestor,
		true,
		false
	],
	[
		a.campaign,
		false,
		true
	],
	[
		commissionPda(a.campaign, a.hash),
		false,
		true
	],
	[
		a.affiliate,
		false,
		true
	]
], Buffer.from([3]));
var release$1 = (a) => ix([
	[
		a.cranker,
		true,
		true
	],
	[
		a.campaign,
		false,
		true
	],
	[
		a.mint,
		false,
		false
	],
	[
		vaultAta(a.mint, a.campaign),
		false,
		true
	],
	[
		commissionPda(a.campaign, a.hash),
		false,
		true
	],
	[
		a.affiliate,
		false,
		true
	],
	[
		a.payee,
		false,
		false
	],
	[
		getAssociatedTokenAddressSync(a.mint, a.payee, true),
		false,
		true
	],
	[
		TP,
		false,
		false
	],
	[
		ATA,
		false,
		false
	],
	[
		SYS,
		false,
		false
	]
], Buffer.from([4]));
var sellCommission = (a) => ix([
	[
		a.seller,
		true,
		false
	],
	[
		a.buyer,
		true,
		false
	],
	[
		a.campaign,
		false,
		false
	],
	[
		commissionPda(a.campaign, a.hash),
		false,
		true
	],
	[
		a.affiliate,
		false,
		false
	],
	[
		a.mint,
		false,
		false
	],
	[
		getAssociatedTokenAddressSync(a.mint, a.buyer),
		false,
		true
	],
	[
		getAssociatedTokenAddressSync(a.mint, a.seller),
		false,
		true
	],
	[
		TP,
		false,
		false
	]
], Buffer.concat([Buffer.from([6]), u64(a.price)]));
var pk = (d, o) => new PublicKey(d.subarray(o, o + 32));
var rd = (d, o) => d.readBigUInt64LE(o);
var decodeCampaign = (d) => ({
	brand: pk(d, 1),
	attestor: pk(d, 33),
	mint: pk(d, 65),
	id: rd(d, 97),
	bps: d.readUInt16LE(105),
	hold: d.readBigInt64LE(107),
	reserved: rd(d, 115),
	paid: rd(d, 123),
	vault: pk(d, 132)
});
var decodeAffiliate = (d) => ({
	campaign: pk(d, 1),
	wallet: pk(d, 33),
	pending: rd(d, 65),
	earned: rd(d, 73)
});
var STATUS = [
	"Pending",
	"Paid",
	"Cancelled"
];
var decodeCommission = (d) => ({
	campaign: pk(d, 1),
	affiliate: pk(d, 33),
	payee: pk(d, 65),
	orderHash: d.subarray(97, 129),
	orderAmount: rd(d, 129),
	amount: rd(d, 137),
	releaseAt: Number(d.readBigInt64LE(145)),
	status: STATUS[d[153]]
});
//#endregion
//#region src/lib/demo.ts
var USDC = 1e6;
var HOLD = Number(process.env.DEMO_HOLD ?? 30);
var DESK_FEE_BPS = 300;
var RPC = process.env.RPC_URL ?? "http://127.0.0.1:8899";
var STATE = resolve(process.cwd(), "../.demo", RPC.includes("devnet") ? "devnet.json" : "local.json");
var PAYER = process.env.DEMO_PAYER ?? homedir() + "/.config/solana/id.json";
var connection = new Connection(RPC, "confirmed");
var kp = (s) => Keypair.fromSecretKey(Uint8Array.from(s));
var payer = kp(JSON.parse(process.env.DEMO_PAYER_KEY ?? readFileSync(PAYER, "utf8")));
var send = (ixs, signers = []) => sendAndConfirmTransaction(connection, new Transaction().add(...ixs), [payer, ...signers], { commitment: "confirmed" });
var saved = process.env.DEMO_KEYS ? JSON.parse(process.env.DEMO_KEYS) : existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
var save = () => {
	mkdirSync(dirname(STATE), { recursive: true });
	writeFileSync(STATE, JSON.stringify(saved));
};
var setup = null;
async function ensure() {
	if (saved) return saved;
	setup ??= (async () => {
		const [brand, attestor, creator, desk, mint] = [
			0,
			1,
			2,
			3,
			4
		].map(() => Keypair.generate());
		if (!RPC.includes("devnet")) await connection.confirmTransaction(await connection.requestAirdrop(payer.publicKey, 50 * LAMPORTS_PER_SOL), "confirmed");
		await send([
			brand,
			attestor,
			creator,
			desk
		].map((k) => SystemProgram.transfer({
			fromPubkey: payer.publicKey,
			toPubkey: k.publicKey,
			lamports: .05 * LAMPORTS_PER_SOL
		})));
		const brandAta = getAssociatedTokenAddressSync(mint.publicKey, brand.publicKey);
		const deskAta = getAssociatedTokenAddressSync(mint.publicKey, desk.publicKey);
		const creatorAta = getAssociatedTokenAddressSync(mint.publicKey, creator.publicKey);
		await send([
			SystemProgram.createAccount({
				fromPubkey: payer.publicKey,
				newAccountPubkey: mint.publicKey,
				lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
				space: MINT_SIZE,
				programId: TOKEN_PROGRAM_ID
			}),
			createInitializeMint2Instruction(mint.publicKey, 6, payer.publicKey, null),
			...[
				[brandAta, brand],
				[deskAta, desk],
				[creatorAta, creator]
			].map(([ata, k]) => createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, k.publicKey, mint.publicKey)),
			createMintToInstruction(mint.publicKey, brandAta, payer.publicKey, 1e3 * USDC),
			createMintToInstruction(mint.publicKey, deskAta, payer.publicKey, 500 * USDC)
		], [mint]);
		const id = BigInt(Date.now());
		const campaign = campaignPda(brand.publicKey, id);
		await send([createCampaign({
			brand: brand.publicKey,
			mint: mint.publicKey,
			id,
			bps: 1e3,
			hold: HOLD,
			attestor: attestor.publicKey
		}), createTransferCheckedInstruction(brandAta, mint.publicKey, vaultAta(mint.publicKey, campaign), brand.publicKey, 300 * USDC, 6)], [brand]);
		await send([joinCampaign(creator.publicKey, campaign)], [creator]);
		saved = {
			brand: [...brand.secretKey],
			attestor: [...attestor.secretKey],
			creator: [...creator.secretKey],
			desk: [...desk.secretKey],
			mint: [...mint.secretKey],
			id: id.toString()
		};
		save();
		return saved;
	})().finally(() => {
		setup = null;
	});
	return setup;
}
async function ctx() {
	const s = await ensure();
	const [brand, attestor, creator, desk, mintKp] = [
		s.brand,
		s.attestor,
		s.creator,
		s.desk,
		s.mint
	].map(kp);
	const mint = mintKp.publicKey;
	const campaign = campaignPda(brand.publicKey, BigInt(s.id));
	return {
		s,
		brand,
		attestor,
		creator,
		desk,
		mint,
		campaign,
		affiliate: affiliatePda(campaign, creator.publicKey)
	};
}
var hex = (h) => {
	if (!/^[0-9a-f]{64}$/.test(h)) throw new Error("bad order");
	return Buffer.from(h, "hex");
};
var balance = async (owner, mint) => {
	const ata = getAssociatedTokenAddressSync(mint, owner);
	const acc = await connection.getAccountInfo(ata, "confirmed");
	return acc ? Number(unpackAccount(ata, acc).amount) / USDC : 0;
};
async function buy(amount) {
	const x = await ctx();
	if (!(amount > 0 && amount <= 1e4)) throw new Error("amount must be between 0 and 10,000");
	return send([recordSale({
		attestor: x.attestor.publicKey,
		campaign: x.campaign,
		mint: x.mint,
		affiliate: x.affiliate,
		hash: orderHash(`order-${Date.now()}-${Math.random()}`),
		orderAmount: Math.round(amount * USDC)
	})], [x.attestor]);
}
async function refund(order) {
	const x = await ctx();
	return send([cancelCommission({
		attestor: x.attestor.publicKey,
		campaign: x.campaign,
		affiliate: x.affiliate,
		hash: hex(order)
	})], [x.attestor]);
}
async function cashOut(order) {
	const x = await ctx();
	const price = decodeCommission((await connection.getAccountInfo(commissionPda(x.campaign, hex(order)))).data).amount * BigInt(9700) / 10000n;
	return send([sellCommission({
		seller: x.creator.publicKey,
		buyer: x.desk.publicKey,
		campaign: x.campaign,
		affiliate: x.affiliate,
		mint: x.mint,
		hash: hex(order),
		price
	})], [x.creator, x.desk]);
}
async function release(order) {
	const x = await ctx();
	const com = decodeCommission((await connection.getAccountInfo(commissionPda(x.campaign, hex(order)))).data);
	return send([release$1({
		cranker: payer.publicKey,
		campaign: x.campaign,
		mint: x.mint,
		affiliate: x.affiliate,
		hash: hex(order),
		payee: com.payee
	})]);
}
async function state() {
	const x = await ctx();
	const [campAcc, affAcc] = await connection.getMultipleAccountsInfo([x.campaign, x.affiliate]);
	const camp = decodeCampaign(campAcc.data);
	const aff = decodeAffiliate(affAcc.data);
	const vaultAcc = await connection.getAccountInfo(camp.vault);
	const vault = Number(unpackAccount(camp.vault, vaultAcc).amount) / USDC;
	const coms = (await connection.getProgramAccounts(PROGRAM_ID, {
		commitment: "confirmed",
		filters: [{ dataSize: 155 }, { memcmp: {
			offset: 1,
			bytes: x.campaign.toBase58()
		} }]
	})).map((a) => ({
		pubkey: a.pubkey,
		d: decodeCommission(a.account.data)
	})).sort((a, b) => Number(b.d.releaseAt) - Number(a.d.releaseAt)).slice(0, 20);
	const now = Math.floor(Date.now() / 1e3);
	return {
		rpc: RPC.includes("devnet") ? "devnet" : RPC.includes("mainnet") ? "mainnet" : "localnet",
		program: PROGRAM_ID.toBase58(),
		campaign: x.campaign.toBase58(),
		vault: camp.vault.toBase58(),
		holdSeconds: Number(camp.hold),
		commissionPct: camp.bps / 100,
		deskFeePct: DESK_FEE_BPS / 100,
		budget: {
			vault,
			reserved: Number(camp.reserved) / USDC,
			free: vault - Number(camp.reserved) / USDC,
			paid: Number(camp.paid) / USDC
		},
		creator: {
			wallet: x.creator.publicKey.toBase58(),
			usdc: await balance(x.creator.publicKey, x.mint),
			pending: Number(aff.pending) / USDC,
			earned: Number(aff.earned) / USDC
		},
		desk: {
			wallet: x.desk.publicKey.toBase58(),
			usdc: await balance(x.desk.publicKey, x.mint)
		},
		orders: coms.map(({ pubkey, d }) => ({
			id: Buffer.from(d.orderHash).toString("hex"),
			amount: Number(d.orderAmount) / USDC,
			commission: Number(d.amount) / USDC,
			status: d.status,
			soldToDesk: d.payee.equals(x.desk.publicKey),
			secondsLeft: Math.max(0, Number(d.releaseAt) - now),
			account: pubkey.toBase58()
		}))
	};
}
//#endregion
//#region src/pages/api/[action].ts
var _action__exports = /* @__PURE__ */ __exportAll({
	GET: () => GET,
	POST: () => POST
});
var json = (body, status = 200) => new Response(JSON.stringify(body), {
	status,
	headers: { "content-type": "application/json" }
});
var GET = async ({ params }) => {
	if (params.action !== "state") return json({ error: "not found" }, 404);
	try {
		return json(await state());
	} catch (e) {
		return json({ error: String(e) }, 500);
	}
};
var POST = async ({ params, request }) => {
	const body = await request.json().catch(() => ({}));
	try {
		const fn = {
			buy: () => buy(Number(body.amount)),
			refund: () => refund(String(body.order)),
			cashout: () => cashOut(String(body.order)),
			release: () => release(String(body.order))
		}[params.action ?? ""];
		if (!fn) return json({ error: "not found" }, 404);
		return json({ signature: await fn() });
	} catch (e) {
		const logs = (e?.logs ?? e?.transactionLogs ?? []).join("\n");
		return json({ error: errorName(e) ?? errorName(logs) ?? String(e.message ?? e) }, 400);
	}
};
//#endregion
//#region \0virtual:astro:page:src/pages/api/[action]@_@ts
var page = () => _action__exports;
//#endregion
export { page };
