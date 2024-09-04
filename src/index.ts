import {
  Keypair,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { struct, u8, str } from "@coral-xyz/borsh";
import { writeFileSync } from "fs";
import dotenv from "dotenv";

dotenv.config();

function initializeSignerKeypair(): Keypair {
  if (!process.env.PRIVATE_KEY) {
    console.log("Creating .env file");
    const signer = Keypair.generate();
    writeFileSync(".env", `PRIVATE_KEY=[${signer.secretKey.toString()}]`);
    return signer;
  }

  const secret = JSON.parse(process.env.PRIVATE_KEY ?? "") as number[];
  const secretKey = Uint8Array.from(secret);
  return Keypair.fromSecretKey(secretKey);
}

async function airdropSolIfNeeded(signer: Keypair, connection: Connection) {
  const balance = await connection.getBalance(signer.publicKey);
  console.log("Current balance is", balance);
  if (balance < LAMPORTS_PER_SOL) {
    console.log("Airdropping 1 SOL...");
    await connection.requestAirdrop(signer.publicKey, LAMPORTS_PER_SOL);
  }
}

const movieInstructionLayout = struct([
  u8("variant"),
  str("title"),
  u8("rating"),
  str("description"),
]);

async function sendTestMovieReview(
  signer: Keypair,
  programId: PublicKey,
  connection: Connection
) {
  let buffer = Buffer.alloc(1000);
  const movieTitle = `Braveheart${Math.random() * 1000000}`;
  movieInstructionLayout.encode(
    {
      variant: 0,
      title: movieTitle,
      rating: 5,
      description: "A great movie",
    },
    buffer
  );

  buffer = buffer.subarray(0, movieInstructionLayout.getSpan(buffer));

  const [pda] = await PublicKey.findProgramAddressSync(
    [signer.publicKey.toBuffer(), Buffer.from(movieTitle)],
    programId
  );

  console.log("PDA is:", pda.toBase58());

  const transaction = new Transaction();

  const instruction = new TransactionInstruction({
    programId: programId,
    data: buffer,
    keys: [
      {
        pubkey: signer.publicKey,
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: pda,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
  });

  transaction.add(instruction);
  const tx = await sendAndConfirmTransaction(connection, transaction, [signer]);
  console.log(`https://explorer.solana.com/tx/${tx}?cluster=devnet`);
}

async function main() {
  const signer = initializeSignerKeypair();

  const connection = new Connection(clusterApiUrl("devnet"));
  await airdropSolIfNeeded(signer, connection);

  const movieProgramId = new PublicKey(
    "FnHUUiX2jLSaGdt6GpgoJYKnUxzbPG5VmRPEDr1NEekm"
  );
  await sendTestMovieReview(signer, movieProgramId, connection);
}

main()
  .then(() => {
    console.log("Finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
