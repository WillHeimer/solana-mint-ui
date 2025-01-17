import React, { useCallback, useEffect, useMemo, useState } from "react"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import {
  CandyGuard,
  CandyMachine,
  DefaultGuardSetMintArgs,
  mplCandyMachine,
} from "@metaplex-foundation/mpl-candy-machine"
import { publicKey, some, unwrapOption } from "@metaplex-foundation/umi"
import {
  fetchCandyMachine,
  fetchCandyGuard,
} from "@metaplex-foundation/mpl-candy-machine"
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters"
import { mintV2 } from "@metaplex-foundation/mpl-candy-machine"
import { setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox"
import { transactionBuilder, generateSigner } from "@metaplex-foundation/umi"
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import Head from "next/head"

import { fromTxError } from "@/utils/errors"

if (!process.env.NEXT_PUBLIC_RPC_ENDPOINT)
  throw new Error(
    "No RPC endpoint. Please, provide a NEXT_PUBLIC_RPC_ENDPOINT env variable"
  )

// Use the RPC endpoint of your choice.
const umi = createUmi(process.env.NEXT_PUBLIC_RPC_ENDPOINT).use(
  mplCandyMachine()
)

const candyMachineId = process.env.NEXT_PUBLIC_CANDY_MACHINE_ID

export default function Index() {
  const [candyMachine, setCandyMachine] = useState<CandyMachine | null>(null)
  const [candyGuard, setCandyGuard] = useState<CandyGuard | null>(null)
  const wallet = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [formMessage, setFormMessage] = useState<string | null>(null)

  const fetchCandyMachineData = useCallback(async () => {
    if (!candyMachineId)
      throw new Error(
        "Please, provide a NEXT_PUBLIC_CANDY_MACHINE_ID env variable"
      )
    const candyMachinePublicKey = publicKey(candyMachineId)
    const candyMachine = await fetchCandyMachine(umi, candyMachinePublicKey)
    const candyGuard = await fetchCandyGuard(umi, candyMachine.mintAuthority)

    setCandyMachine(candyMachine)
    setCandyGuard(candyGuard)
  }, [candyMachineId])

  // Fetch candy machine on mount
  useEffect(() => {
    fetchCandyMachineData()
  }, [fetchCandyMachineData])

  const solPaymentGuard = useMemo(() => {
    return candyGuard ? unwrapOption(candyGuard.guards.solPayment) : null
  }, [candyGuard])

  const cost = useMemo(
    () =>
      candyGuard
        ? solPaymentGuard
          ? Number(solPaymentGuard.lamports.basisPoints) / (1e9 * 0.8) + " SOL"
          : "Free mint"
        : "...",
    [candyGuard]
  )

  const mint = async () => {
    if (!candyMachine) throw new Error("No candy machine")
    if (!candyGuard)
      throw new Error(
        "No candy guard found. Set up a guard for your candy machine."
      )

    setIsLoading(true)
    const { guards } = candyGuard

    const enabledGuardsKeys =
      guards && Object.keys(guards).filter((guardKey) => guards[guardKey])

    let mintArgs: Partial<DefaultGuardSetMintArgs> = {}

    // If there are enabled guards, set the mintArgs
    if (enabledGuardsKeys.length) {
      // Map enabled guards and set mintArgs automatically based on the fields defined in each guard
      enabledGuardsKeys.forEach((guardKey) => {
        const guardObject = unwrapOption(candyGuard.guards[guardKey])
        if (!guardObject) return null

        mintArgs = { ...mintArgs, [guardKey]: some(guardObject) }
      })
    }

    const umiWalletAdapter = umi.use(walletAdapterIdentity(wallet))
    const nftMint = generateSigner(umiWalletAdapter)

    try {
      await transactionBuilder()
        .add(setComputeUnitLimit(umiWalletAdapter, { units: 800_000 }))
        .add(
          mintV2(umiWalletAdapter, {
            candyMachine: candyMachine.publicKey,
            nftMint,
            collectionMint: candyMachine.collectionMint,
            collectionUpdateAuthority: candyMachine.authority,
            tokenStandard: candyMachine.tokenStandard,
            candyGuard: candyGuard?.publicKey,
            mintArgs,
          })
        )
        .sendAndConfirm(umiWalletAdapter)

      setFormMessage("Minted successfully! Check your wallet")
    } catch (e: any) {
      const msg = fromTxError(e)

      if (msg) {
        setFormMessage(msg.message)
      } else {
        const msg = e.message || e.toString()
        setFormMessage(msg)
      }
    } finally {
      setIsLoading(false)

      setTimeout(() => {
        setFormMessage(null)
      }, 5000)
    }

    setIsLoading(false)
  }

  return (
    <>
      <Head>
        <title>Numbers Collection Mint</title>
        <meta name="description" content="Get your unique NFT now!" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div>
        <main
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "96px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "32px",
              alignItems: "flex-start",
            }}
          >
            <img
              style={{ maxWidth: "396px", borderRadius: "8px" }}
              // src={collection?.json?.image}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#111",
                padding: "32px 24px",
                borderRadius: "16px",
                border: "1px solid #222",
                width: "320px",
              }}
            >
              <h1>Mint A Degen Inu</h1>
              <p style={{ color: "#807a82", marginBottom: "16px" }}>
                Mint your Degen Inu now. You will receive a random NFT from our
                1st collection.
              </p>
              <div style={{ marginBottom: "16px" }}>
                <a
                  href="https://magiceden.io/marketplace/6ahYmH4DX35r6LyTQTEVWzLR893BPY8UpWZ74tE7ubMJ"
                  target="_blank" // Opens the link in a new tab
                  rel="noopener noreferrer" // Security measure for opening links in a new tab
                  style={{ textDecoration: "underline" }} // Ensures the link is underlined
                >
                  View our collection on Magic Eden
                </a>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: "#261727",
                  padding: "16px 12px",
                  borderRadius: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Public</span>
                  <b>{cost}</b>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "16px",
                  }}
                >
                  <span style={{ fontSize: "11px" }}>
                    100 MAX - 3 MAX PER WALLET
                  </span>
                </div>
                <button disabled={!publicKey || isLoading} onClick={mint}>
                  {isLoading ? "Minting your NFT..." : "Mint"}
                </button>
                <WalletMultiButton
                  style={{
                    width: "100%",
                    height: "auto",
                    marginTop: "8px",
                    padding: "8px 0",
                    justifyContent: "center",
                    fontSize: "13px",
                    backgroundColor: "#111",
                    lineHeight: "1.45",
                  }}
                />
                <p
                  style={{
                    textAlign: "center",
                    marginTop: "4px",
                  }}
                >
                  {formMessage}
                </p>
                <div
                  style={{
                    marginTop: "10px",
                    alignContent: "center",
                    textAlign: "center",
                  }}
                ></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
