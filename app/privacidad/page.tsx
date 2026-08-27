import type { Metadata } from "next";
import Link from "next/link";
import { brandName } from "@/lib/brand-server";
import { siteOrigin } from "@/lib/origin";
import { breadcrumbJsonLd } from "@/lib/jsonld";
import { JsonLd } from "@/components/JsonLd";
import { PageHero, Prose, Section } from "@/components/MarketingUI";
import { CONTACT_EMAIL } from "@/config/contact";

export const dynamic = "force-dynamic";

const TITLE = "Política de privacidad";
const LAST_UPDATED = "julio de 2026";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await brandName();
  return {
    title: `${TITLE}`,
    description: `Cómo ${brand} recolecta, usa y protege tus datos personales.`,
    alternates: { canonical: `${await siteOrigin()}/privacidad` },
  };
}

/**
 * Describes what the app actually does today: leads stored in MySQL and
 * forwarded to the CRM, a session cookie for logged-in publishers, viewing
 * history kept in the browser's localStorage, OpenStreetMap tiles on map
 * views. Keep this page in sync when a new data flow is added — a privacy
 * policy that describes a different product than the one shipped is worse
 * than none.
 *
 * TODO (founder, before launch): add the razón social, RUC and domicilio of
 * the responsible entity, and confirm the text with a Paraguayan lawyer.
 */
export default async function PrivacidadPage() {
  const origin = await siteOrigin();

  return (
    <main>
      <JsonLd
        data={[
          breadcrumbJsonLd(origin, [
            { name: "Inicio", url: "/" },
            { name: TITLE, url: "/privacidad" },
          ]),
        ]}
      />

      <PageHero
        title={TITLE}
        subtitle={`Última actualización: ${LAST_UPDATED}`}
      />

      <Section width="narrow">
        <Prose>
          <h2>1. Qué datos recolectamos</h2>
          <p>Solo los que hacen falta para que el portal funcione:</p>
          <ul>
            <li>
              <strong>Datos de contacto que nos das</strong>: nombre, número de
              WhatsApp, correo electrónico y el mensaje que escribís cuando
              consultás por una propiedad, pedís una tasación o solicitás una
              cuenta profesional.
            </li>
            <li>
              <strong>Datos de tu cuenta</strong>, si publicás: nombre, teléfono,
              correo, y los datos de la inmobiliaria o del agente cuando
              corresponde.
            </li>
            <li>
              <strong>Contenido de tus avisos</strong>: fotos, ubicación, precio
              y descripción de los inmuebles que publicás.
            </li>
            <li>
              <strong>Datos técnicos básicos</strong>: dirección IP, tipo de
              navegador y páginas visitadas, en registros del servidor que
              usamos para seguridad y diagnóstico.
            </li>
            <li>
              <strong>Parámetros de campaña</strong> (utm_source y similares)
              cuando llegás desde un anuncio o un enlace de campaña, para saber
              qué canal funciona.
            </li>
          </ul>
          <p>
            No pedimos ni almacenamos datos de tarjetas de crédito, número de
            cédula ni información financiera para usar el portal.
          </p>

          <h2>2. Para qué los usamos</h2>
          <ul>
            <li>
              Poner en contacto tu consulta con quien publicó la propiedad
              (tu nombre, tu WhatsApp y tu mensaje se comparten con esa persona
              o inmobiliaria: es el objeto mismo de la consulta).
            </li>
            <li>Responder tus pedidos de tasación, publicación o soporte.</li>
            <li>Operar tu cuenta y mostrar tus avisos.</li>
            <li>
              Mantener la seguridad del sitio y prevenir abusos o publicaciones
              fraudulentas.
            </li>
            <li>
              Elaborar estadísticas agregadas del mercado —medianas de precio
              por zona, por ejemplo— que no identifican a ninguna persona.
            </li>
          </ul>
          <p>
            No vendemos tus datos personales ni los cedemos a terceros para su
            publicidad.
          </p>

          <h2>3. Con quién los compartimos</h2>
          <ul>
            <li>
              <strong>Con quien publicó la propiedad</strong>, cuando enviás una
              consulta sobre su aviso.
            </li>
            <li>
              <strong>Con nuestros proveedores de tecnología</strong>, que
              procesan datos por cuenta nuestra y solo para prestarnos el
              servicio: el proveedor de hosting y base de datos, el sistema de
              gestión de contactos (CRM) donde se registran las consultas
              recibidas, y el servicio de almacenamiento de las imágenes de los
              avisos.
            </li>
            <li>
              <strong>Con autoridades competentes</strong>, cuando exista una
              obligación legal o una orden judicial.
            </li>
          </ul>

          <h2>4. Cookies y almacenamiento en tu navegador</h2>
          <p>
            Usamos una cookie técnica de sesión para mantenerte identificado
            mientras estás logueado en el panel de publicación. Es necesaria
            para el funcionamiento del sitio y se elimina al cerrar sesión o al
            expirar.
          </p>
          <p>
            La lista de «propiedades vistas recientemente» se guarda únicamente
            en el almacenamiento local de tu navegador (localStorage): no se
            envía a nuestros servidores y podés borrarla limpiando los datos del
            sitio desde tu navegador.
          </p>
          <p>
            Los mapas del portal cargan imágenes de mosaicos desde
            OpenStreetMap; al mostrarse, tu navegador se conecta a ese servicio,
            que puede registrar la solicitud según su propia política.
          </p>

          <h2>5. Cuánto tiempo los conservamos</h2>
          <p>
            Las consultas y los datos de cuenta se conservan mientras la cuenta
            esté activa y por el plazo necesario para atender reclamos o cumplir
            obligaciones legales. Después se eliminan o se anonimizan. Las
            estadísticas agregadas del mercado, al no identificar personas, se
            conservan de forma indefinida.
          </p>

          <h2>6. Tus derechos</h2>
          <p>
            Podés pedirnos en cualquier momento acceder a tus datos,
            rectificarlos si están desactualizados o incorrectos, o solicitar su
            eliminación y la baja de tu cuenta. Escribinos desde la{" "}
            <Link href="/contacto">página de contacto</Link>
            {CONTACT_EMAIL ? <> o a {CONTACT_EMAIL}</> : null}. Respondemos
            dentro de los plazos que establece
            la normativa aplicable en Paraguay, incluida la Ley N.º 6534/2020 de
            protección de datos personales crediticios en lo que resulte
            pertinente.
          </p>
          <p>
            Tené en cuenta que si ya enviaste una consulta a una inmobiliaria,
            esos datos también quedaron en su poder: la baja en ese caso se pide
            directamente a ella.
          </p>

          <h2>7. Seguridad</h2>
          <p>
            El sitio se sirve por conexión cifrada (HTTPS), las contraseñas se
            almacenan cifradas y el acceso a la base de datos está restringido.
            Ningún sistema es infalible: si detectamos un incidente que afecte
            tus datos, lo comunicaremos por los medios de contacto que tengamos.
          </p>

          <h2>8. Menores de edad</h2>
          <p>
            El portal está dirigido a personas mayores de 18 años. No
            recolectamos deliberadamente datos de menores.
          </p>

          <h2>9. Cambios en esta política</h2>
          <p>
            Si cambiamos la forma en que tratamos los datos, actualizaremos esta
            página y su fecha de última actualización.
          </p>
        </Prose>
      </Section>
    </main>
  );
}
