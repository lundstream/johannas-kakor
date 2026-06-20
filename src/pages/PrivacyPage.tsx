import { LegalPage, LegalH2 } from '../components/LegalPage';

/**
 * UTKAST – Integritetspolicy. Måste granskas av kvalificerad person innan
 * publicering. Platshållare [I HAKPARENTES] och "(bekräfta)" ska fyllas i/bekräftas.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Integritetspolicy">
      <p>
        Den här policyn beskriver hur dina personuppgifter behandlas när du använder Enkel Etikett
        ("tjänsten"). Vi strävar efter att samla in så lite uppgifter som möjligt och att vara
        tydliga med hur de används.
      </p>

      <section className="flex flex-col gap-2">
        <LegalH2>1. Personuppgiftsansvarig</LegalH2>
        <p>
          Personuppgiftsansvarig för behandlingen är [KONTROLLANT-NAMN],
          [ORG-NR ELLER PERSONNUMMER / EJ TILLÄMPLIGT], [ADRESS]. Kontakt:{' '}
          [KONTAKT-EMAIL].
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>2. Vilka uppgifter vi behandlar</LegalH2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Kontouppgifter:</strong> e-postadress, eventuellt namn, samt en krypterad
            (hashad) version av ditt lösenord om du använder lösenordsinloggning.
          </li>
          <li>
            <strong>Innehåll du skapar:</strong> etiketter, mallar och egna ingredienser som du
            sparar i ditt konto.
          </li>
          <li>
            <strong>Tekniska uppgifter:</strong> IP-adress, serverloggar, tidpunkter för
            inloggning och en nödvändig sessionscookie (<code>bl_session</code>).
          </li>
          <li>
            <strong>Betalningsuppgifter:</strong> hanteras av Stripe. Vi lagrar endast referenser
            (t.ex. kund- och prenumerations-ID) – aldrig fullständiga kortuppgifter.
          </li>
        </ul>
        <p className="text-sm text-ink/60">
          I det inloggningsfria läget sparas dina utkast endast lokalt i din webbläsare
          (localStorage) och skickas inte till oss.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>3. Ändamål och rättslig grund</LegalH2>
        <ul className="list-disc pl-5">
          <li>
            <strong>Tillhandahålla tjänsten</strong> (konto, spara och skriva ut etiketter) – rättslig
            grund: fullgörande av avtal.
          </li>
          <li>
            <strong>Skicka inloggningslänkar</strong> via e-post – fullgörande av avtal.
          </li>
          <li>
            <strong>Drift och säkerhet</strong> (loggar, missbruksskydd) – berättigat intresse.
          </li>
          <li>
            <strong>Betalning och bokföring</strong> (vid betald plan) – fullgörande av avtal samt
            rättslig förpliktelse.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>4. Cookies</LegalH2>
        <p>
          Vi använder endast nödvändiga cookies: en förstaparts sessionscookie för inloggning
          (<code>bl_session</code>) samt säkerhetscookies som sätts av Cloudflare. Vi använder inga
          analys-, spårnings- eller marknadsföringscookies, och därför visas ingen
          samtyckesruta. Betalflödet hanteras av Stripe på Stripes egna sidor.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>5. Lagringstid</LegalH2>
        <ul className="list-disc pl-5">
          <li>Kontouppgifter och innehåll: så länge du har ett konto. Du kan radera kontot när som helst.</li>
          <li>Serverloggar: [30 dagar] (bekräfta).</li>
          <li>Inloggningslänkar (engångstokens): upphör efter angiven giltighetstid och rensas löpande.</li>
          <li>Bokföringsunderlag vid betalning: så länge bokföringslagen kräver (normalt 7 år) (bekräfta).</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>6. Mottagare och underbiträden</LegalH2>
        <p>Vi anlitar följande underbiträden för att kunna leverera tjänsten:</p>
        <ul className="list-disc pl-5">
          <li><strong>Google Workspace / Gmail</strong> – leverans av e-post (inloggningslänkar).</li>
          <li><strong>Stripe</strong> – betalningar och prenumerationshantering.</li>
          <li><strong>Cloudflare</strong> – CDN, säkerhet och trafik till tjänsten.</li>
        </ul>
        <p className="text-sm text-ink/60">
          Tjänsten driftas på egen server. (bekräfta ev. ytterligare driftleverantör)
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>7. Överföring till tredjeland</LegalH2>
        <p>
          Vissa underbiträden (Google, Stripe, Cloudflare) kan behandla uppgifter utanför EU/EES.
          Sådan överföring sker med lämpliga skyddsåtgärder, t.ex. EU-kommissionens
          standardavtalsklausuler (SCC). (bekräfta)
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>8. Dina rättigheter</LegalH2>
        <p>Du har rätt att begära:</p>
        <ul className="list-disc pl-5">
          <li>tillgång till dina uppgifter,</li>
          <li>rättelse av felaktiga uppgifter,</li>
          <li>radering ("rätten att bli bortglömd"),</li>
          <li>dataportabilitet (export av dina uppgifter),</li>
          <li>begränsning av eller invändning mot behandling.</li>
        </ul>
        <p>
          Du kan exportera och radera dina uppgifter direkt under <strong>Konto</strong> när du är
          inloggad. Du har även rätt att lämna klagomål till tillsynsmyndigheten
          Integritetsskyddsmyndigheten (IMY).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>9. Säkerhet</LegalH2>
        <p>
          Uppgifter överförs krypterat (TLS). Lösenord lagras aldrig i klartext utan som en hash
          (bcrypt). Åtkomst till uppgifter begränsas till vad som krävs för att driva tjänsten.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>10. Ändringar</LegalH2>
        <p>
          Vi kan uppdatera den här policyn. Väsentliga ändringar meddelas i tjänsten eller via
          e-post.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <LegalH2>11. Kontakt</LegalH2>
        <p>Frågor om behandlingen av personuppgifter: [KONTAKT-EMAIL].</p>
      </section>
    </LegalPage>
  );
}
