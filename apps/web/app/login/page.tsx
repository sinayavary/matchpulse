import WalletLogin from "../../components/auth/WalletLogin";
export default function LoginPage() { return <main><h1>Sign in to MatchPulse</h1><p>Wallet signing is off-chain identity only. No transaction, fee, private key, or seed phrase is requested.</p><WalletLogin /></main>; }
