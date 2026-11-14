/* Messages en français pour les erreurs de Supabase Auth */
export function messageErreurAuth(code: string | undefined, parDefaut: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Email ou mot de passe incorrect.";
    case "user_banned":
      return "Cet accès a été coupé. Contactez un autre admin.";
    case "email_not_confirmed":
      return "Invitation pas encore acceptée : ouvrez le lien reçu pour choisir votre mot de passe.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives. Réessayez dans quelques minutes.";
    case "same_password":
      return "Ce mot de passe est identique à l'ancien : choisissez-en un autre.";
    case "weak_password":
      return "Mot de passe trop faible : allongez-le ou mélangez lettres, chiffres et symboles.";
    case "otp_expired":
      return "Ce lien n'est plus valide.";
    default:
      return parDefaut;
  }
}
