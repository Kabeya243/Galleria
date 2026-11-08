// Contact form of a published advanced site — verbatim copy of the
// standalone builder's contact-form.tsx (mailto via the visitor's
// own mail app, no external service).
"use client";

import { FormEvent, useState } from "react";
import { Send } from "lucide-react";

export function ContactForm({ email, subject }: { email: string; subject: string }) {
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const sender = String(form.get("email") ?? "").trim();
    const body = String(form.get("message") ?? "").trim();
    if (!name || !sender || !body) {
      setMessage("Merci de remplir tous les champs.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)) {
      setMessage("Saisissez une adresse e-mail valide.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("L’adresse e-mail de contact du site n’est pas configurée.");
      return;
    }
    const mailBody = `Nom : ${name}\nE-mail : ${sender}\n\n${body}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;
    setMessage("Votre application de messagerie va s’ouvrir avec le message prérempli. Envoyez-le depuis cette application.");
  }

  return <form className="published-contact-form" onSubmit={submit} noValidate>
    <label>Votre nom<input name="name" autoComplete="name" required maxLength={120} /></label>
    <label>Votre e-mail<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    <label>Votre message<textarea name="message" rows={5} required maxLength={5000} /></label>
    <button className="published-button" type="submit">Préparer le message<Send size={14} aria-hidden="true" /></button>
    {message && <p className="contact-form-message" role="status">{message}</p>}
  </form>;
}
