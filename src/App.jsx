import { useEffect, useState } from "react";
import {
  BrowserProvider,
  Contract,
  ZeroAddress,
  formatEther,
} from "ethers";

import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  CHAIN_ID,
  NETWORK_NAME,
  NETWORK_LABEL,
  EXPLORER_URL,
} from "./contract";

import "./App.css";

const TOTAL_DESKS = 12;

function getTomorrowUTC() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function toTimestamp(dateString) {
  return Math.floor(
    Date.parse(`${dateString}T00:00:00Z`) / 1000
  );
}

function shorten(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function errorMessage(error) {
  if (
    error.code === "ACTION_REJECTED" ||
    error.code === 4001 ||
    error.info?.error?.code === 4001
  ) {
    return "Request cancelled in your wallet.";
  }

  return (
    error.reason ||
    error.shortMessage ||
    error.message ||
    "Something went wrong. Please try again."
  );
}

async function getProvider() {
  if (!window.ethereum) {
    throw new Error("Please install and enable MetaMask.");
  }

  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();

  if (network.chainId !== CHAIN_ID) {
    throw new Error(
      `Switch this site's wallet network to ${NETWORK_NAME} (${CHAIN_ID.toString()}), then try again.`
    );
  }

  const code = await provider.getCode(CONTRACT_ADDRESS);

  if (code === "0x") {
    throw new Error(
      `Contract not found on ${NETWORK_NAME}. Check the configured deployment address.`
    );
  }

  return provider;
}

export default function App() {
  const [account, setAccount] = useState("");
  const [connecting, setConnecting] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getTomorrowUTC);
  const [selectedDesk, setSelectedDesk] = useState(null);

  const [dailyRate, setDailyRate] = useState(null);
  const [owners, setOwners] = useState([]);
  const [loadedDate, setLoadedDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const minimumDate = getTomorrowUTC();

  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) &&
    selectedDate >= minimumDate;

  const dataReady =
    Boolean(account) &&
    validDate &&
    !loading &&
    !loadError &&
    loadedDate === selectedDate &&
    dailyRate !== null &&
    owners.length === TOTAL_DESKS;

  const availableCount = dataReady
    ? owners.filter((owner) => owner === ZeroAddress).length
    : "—";

  const rateLabel =
    dailyRate === null ? "—" : `${formatEther(dailyRate)} ETH`;

  // Reload when the wallet changes account or network.
  useEffect(() => {
    const wallet = window.ethereum;
    if (!wallet) return;

    function handleWalletChange() {
      window.location.reload();
    }

    wallet.on("accountsChanged", handleWalletChange);
    wallet.on("chainChanged", handleWalletChange);

    return () => {
      wallet.removeListener("accountsChanged", handleWalletChange);
      wallet.removeListener("chainChanged", handleWalletChange);
    };
  }, []);

  // Read the rate and all 12 booking owners for the selected day.
  useEffect(() => {
    if (!account || !validDate) return;

    let cancelled = false;

    async function loadBookings() {
      setLoading(true);
      setLoadError("");
      setLoadedDate("");

      try {
        const provider = await getProvider();

        const contract = new Contract(
          CONTRACT_ADDRESS,
          CONTRACT_ABI,
          provider
        );

        const timestamp = toTimestamp(selectedDate);

        // Use one block so all displayed values share the same snapshot.
        const blockTag = await provider.getBlockNumber();

        const [rate, bookingOwners] = await Promise.all([
          contract.dailyRate({ blockTag }),

          Promise.all(
            Array.from({ length: TOTAL_DESKS }, (_, index) =>
              contract.getBookingOwner(
                index + 1,
                timestamp,
                { blockTag }
              )
            )
          ),
        ]);

        if (!cancelled) {
          setDailyRate(rate);
          setOwners(bookingOwners);
          setLoadedDate(selectedDate);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(errorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadBookings();

    // Ignore an old response if the user selects another date.
    return () => {
      cancelled = true;
    };
  }, [account, selectedDate, validDate, refreshCount]);

  async function connectWallet() {
    setConnecting(true);
    setMessage("");

    try {
      if (!window.ethereum) {
        throw new Error("Please install and enable MetaMask.");
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts.length) {
        throw new Error("No wallet account was selected.");
      }

      await getProvider();
      setAccount(accounts[0]);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setConnecting(false);
    }
  }

  function handleDateChange(event) {
    setSelectedDate(event.target.value);
    setSelectedDesk(null);
    setMessage("");
    setConfirmation(null);
  }

  function refreshBookings() {
    setSelectedDesk(null);
    setLoadedDate("");
    setRefreshCount((count) => count + 1);
  }

  async function bookDesk() {
    if (!dataReady || selectedDesk === null || pending) return;

    const deskId = selectedDesk;
    const date = selectedDate;

    setPending(true);
    setConfirmation(null);
    setMessage("Please confirm the booking in MetaMask.");

    try {
      const provider = await getProvider();
      const signer = await provider.getSigner();

      // Ensure the signer is still the account shown in the UI.
      const signerAddress = await signer.getAddress();

      if (signerAddress.toLowerCase() !== account.toLowerCase()) {
        throw new Error(
          "Wallet account changed. Reload the page and reconnect."
        );
      }

      const contract = new Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      // Read the latest price immediately before sending.
      const latestRate = await contract.dailyRate();

      if (latestRate !== dailyRate) {
        throw new Error(
          "The daily rate has changed. Refresh availability and review the new price."
        );
      }

      const transaction = await contract.bookDesk(
        deskId,
        toTimestamp(date),
        { value: latestRate }
      );

      setMessage("Transaction submitted. Waiting for confirmation…");

      const receipt = await transaction.wait();

      if (!receipt || receipt.status !== 1) {
        throw new Error("The booking transaction did not succeed.");
      }

      setConfirmation({
        deskId,
        date,
        customer: signerAddress,
        amount: formatEther(latestRate),
        hash: receipt.hash,
      });

      setMessage("Booking confirmed on the blockchain.");
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending(false);
      refreshBookings();
    }
  }

  return (
    <div className="app">
      <header className="header">
        <a className="brand" href="./">
          <span className="brand-icon">C</span>
          <span>Coworking Desk</span>
        </a>

        <button
          type="button"
          className="demo-badge wallet-button"
          onClick={connectWallet}
          disabled={connecting || pending || Boolean(account)}
        >
          {connecting
            ? "CONNECTING…"
            : account
              ? `${NETWORK_LABEL} · ${shorten(account)}`
              : "CONNECT WALLET"}
        </button>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">A SPACE TO DO YOUR BEST WORK</p>
          <h1>Your space. Your focus.</h1>
          <p className="hero-description">
            Find your desk, choose your day, and make room for great work.
          </p>
        </section>

        <section className="stats" aria-label="Workspace overview">
          <div className="stat">
            <span>Total desks</span>
            <strong>{TOTAL_DESKS}</strong>
          </div>

          <div className="stat">
            <span>Available on your selected date</span>
            <strong>{availableCount}</strong>
          </div>

          <div className="stat">
            <span>Rate per desk / day</span>
            <strong>{rateLabel}</strong>
          </div>
        </section>

        <div className="booking-layout">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">THE WORKSPACE</p>
                <h2>Choose your desk</h2>
              </div>

              <div className="date-field">
                <label htmlFor="booking-date">Booking date · UTC</label>

                <input
                  id="booking-date"
                  type="date"
                  min={minimumDate}
                  value={selectedDate}
                  disabled={pending}
                  onChange={handleDateChange}
                />
              </div>
            </div>

            <div className="legend">
              <span><i className="dot available" />Available</span>
              <span><i className="dot selected" />Selected</span>
              <span><i className="dot booked" />Booked</span>
            </div>

            {!account && (
              <p className="room-note">
                Connect your wallet on {NETWORK_NAME} to load availability.
              </p>
            )}

            {!validDate && (
              <p className="date-error">
                Please select {minimumDate} or a later date (UTC).
              </p>
            )}

            {loading && <p role="status">Loading availability…</p>}

            {loadError && (
              <p className="date-error" role="alert">{loadError}</p>
            )}

            <div className="desk-grid" aria-busy={loading}>
              {Array.from({ length: TOTAL_DESKS }, (_, index) => {
                const deskId = index + 1;
                const owner = dataReady ? owners[index] : null;
                const isBooked = owner !== null && owner !== ZeroAddress;
                const isSelected = selectedDesk === deskId;

                const status = isBooked
                  ? "booked"
                  : isSelected
                    ? "selected"
                    : "available";

                return (
                  <button
                    key={deskId}
                    type="button"
                    className={`desk ${status}`}
                    disabled={!dataReady || isBooked || pending}
                    aria-pressed={isSelected}
                    title={isBooked ? `Booked by ${owner}` : undefined}
                    onClick={() => {
                      setSelectedDesk(deskId);
                      setMessage("");
                      setConfirmation(null);
                    }}
                  >
                    <span className="desk-symbol" aria-hidden="true" />

                    <strong>
                      Desk {String(deskId).padStart(2, "0")}
                    </strong>

                    <span>
                      {!dataReady
                        ? "Not loaded"
                        : isBooked
                          ? "Booked"
                          : isSelected
                            ? "Selected"
                            : "Available"}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              className="refresh-button"
              type="button"
              onClick={refreshBookings}
              disabled={!account || loading || pending || !validDate}
            >
              Refresh availability
            </button>

            <p className="room-note">
              12 dedicated desks · One desk, one day, one booking
            </p>
          </section>

          <aside className="panel summary">
            <p className="eyebrow">YOUR RESERVATION</p>
            <h2>Make it yours</h2>

            <dl className="summary-details">
              <div>
                <dt>Desk</dt>
                <dd>
                  {selectedDesk === null
                    ? "Not selected"
                    : `Desk ${String(selectedDesk).padStart(2, "0")}`}
                </dd>
              </div>

              <div>
                <dt>Date · UTC</dt>
                <dd>{selectedDate || "Not selected"}</dd>
              </div>

              <div>
                <dt>Duration</dt>
                <dd>1 day</dd>
              </div>

              <div>
                <dt>Network</dt>
                <dd>{NETWORK_NAME}</dd>
              </div>
            </dl>

            <div className="total">
              <span>Booking fee</span>
              <strong>{dataReady ? rateLabel : "—"}</strong>
            </div>

            <p className="fee-note">
              Network gas fees apply separately.
            </p>

            <button
              className="primary-button"
              type="button"
              disabled={!dataReady || selectedDesk === null || pending}
              onClick={bookDesk}
            >
              {pending ? "Booking in progress…" : "Confirm booking"}
            </button>

            <p className="demo-note">
              {NETWORK_NAME} test network · Uses test ETH.
              Bookings are stored in the smart contract.
            </p>

            <div className="message" role="status" aria-live="polite">
              {message}
            </div>

            {confirmation && (
              <div className="confirmation">
                <strong>Reservation confirmed</strong>
                <p>Desk: {confirmation.deskId}</p>
                <p>Date: {confirmation.date} · UTC</p>
                <p>Paid: {confirmation.amount} ETH + gas</p>
                <p>Customer: {confirmation.customer}</p>
                <p>Transaction: {confirmation.hash}</p>

                {EXPLORER_URL && (
                  <p>
                    <a
                      href={`${EXPLORER_URL}/tx/${confirmation.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View transaction on Etherscan ↗
                    </a>
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </main>

      <footer>
        Coworking Desk Booking · Blockchain Mini Project
      </footer>
    </div>
  );
}