import { redirect } from "next/navigation";
import { auth, configuredSocialProviders } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { FigureBrand } from "@/components/product-shell";

export default async function RegisterPage() {
  if (await auth()) redirect("/library");
  return <main className="auth-page"><header><FigureBrand /></header><div className="auth-layout"><div className="auth-art register-art"><p>12 CREDITS, ON US</p><h2>Turn twelve questions into twelve things you truly understand.</h2><div className="credit-stack"><i>✦</i><strong>12</strong><span>free figure credits</span></div></div><AuthForm mode="register" social={configuredSocialProviders()} /></div></main>;
}
