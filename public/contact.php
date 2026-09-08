<?php
/**
 * Contact form handler for cPanel/Apache hosting.
 *
 * The site is static; this small PHP script receives the contact form POST and
 * emails it to the studio using the server's own mail system (cPanel/Exim), so
 * no third party (FormSubmit, Resend, etc.) is involved. cPanel signs outgoing
 * mail for the domain with DKIM and the server is in the domain's SPF record,
 * so mail sent FROM an address on this domain lands reliably — no SMTP password
 * needs to be stored anywhere.
 *
 * ── SETUP (once, in cPanel) ──────────────────────────────────────────────────
 * 1. Create the "from" address below as a FORWARDER, not a mailbox: cPanel →
 *    Forwarders → website@healthhubtweedcoast.com.au → forward to
 *    health@pottsvilleacupuncture.com.au. This way it needs no inbox anyone
 *    checks — the studio only ever uses health@ — yet if anyone emails it or a
 *    bounce comes back, it lands in health@ and nothing is missed. (Normal
 *    replies already go to the visitor via Reply-To, not to this address.)
 * 2. Check cPanel → Email Deliverability shows SPF and DKIM "Valid" for
 *    healthhubtweedcoast.com.au (cPanel sets these up automatically).
 * 3. AT LAUNCH: change $RECIPIENT below from the test inbox to
 *    health@pottsvilleacupuncture.com.au.
 *
 * NOTE: served as source text on a static host (e.g. Cloudflare); it only
 * executes on PHP hosting (cPanel). It holds no passwords, so that's harmless —
 * but the contact form only works once the site is on cPanel.
 */

// ── Config ───────────────────────────────────────────────────────────────────
$RECIPIENT  = 'health@pottsvilleacupuncture.com.au';        // LIVE — enquiries go to the studio inbox
$FROM_EMAIL = 'website@healthhubtweedcoast.com.au';         // a forwarder on this domain (see SETUP above)
$FROM_NAME  = 'Health Hub Tweed Coast website';
$SUBJECT    = 'New enquiry — Health Hub Tweed Coast website';
$SUCCESS    = '/contact/?sent=1';   // matches the confirmation the page shows
$FAILURE    = '/contact/?error=1';

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Send a relative redirect and stop. */
function bounce($path) { header('Location: ' . $path, true, 303); exit; }
/** Collapse CR/LF so form values can't be used to inject extra mail headers. */
function oneLine($s) { return trim(preg_replace('/[\r\n]+/', ' ', (string) $s)); }

// Only accept POST.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') { bounce('/contact/'); }

// Honeypot: humans never see the `_honey` field; if it's filled, it's a bot.
// Pretend success so the bot moves on, but send nothing.
if (!empty($_POST['_honey'])) { bounce($SUCCESS); }

// Collect + trim, capping lengths so an abusive payload can't be huge.
$name    = oneLine($_POST['name']    ?? '');
$email   = oneLine($_POST['email']   ?? '');
$phone   = oneLine($_POST['phone']   ?? '');
$message = trim((string) ($_POST['message'] ?? ''));
$name    = mb_substr($name, 0, 120);
$email   = mb_substr($email, 0, 200);
$phone   = mb_substr($phone, 0, 60);
$message = mb_substr($message, 0, 5000);

// Validate the essentials.
$emailOk = (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
if ($name === '' || !$emailOk || $message === '') { bounce($FAILURE); }

// Build the email.
$body  = "New enquiry from the Health Hub Tweed Coast website\n";
$body .= "----------------------------------------------------\n\n";
$body .= "Name:    $name\n";
$body .= "Email:   $email\n";
$body .= "Phone:   " . ($phone !== '' ? $phone : '(not given)') . "\n\n";
$body .= "Message:\n$message\n";

$headers   = [];
$headers[] = 'From: ' . $FROM_NAME . ' <' . $FROM_EMAIL . '>';
$headers[] = 'Reply-To: ' . $name . ' <' . $email . '>';   // replying goes to the visitor
$headers[] = 'Content-Type: text/plain; charset=UTF-8';
$headers[] = 'MIME-Version: 1.0';

// The 5th arg sets the envelope sender to our domain, which helps SPF pass.
$sent = @mail($RECIPIENT, $SUBJECT, $body, implode("\r\n", $headers), '-f' . $FROM_EMAIL);

// Best-effort: also record the enquiry in the CMS inbox (healthhub-cms-auth
// worker). Wrapped so a slow/failed call never affects the email or the
// visitor's confirmation. No secret needed — the endpoint is guarded by a
// honeypot + per-IP rate limit and only accepts these plain fields.
$enq = http_build_query([
  'name' => $name, 'email' => $email, 'phone' => $phone, 'message' => $message,
]);
$ctx = stream_context_create(['http' => [
  'method'        => 'POST',
  'header'        => "Content-Type: application/x-www-form-urlencoded\r\n",
  'content'       => $enq,
  'timeout'       => 3,
  'ignore_errors' => true,
]]);
@file_get_contents('https://healthhub-cms-auth.clent.workers.dev/enquiry', false, $ctx);

bounce($sent ? $SUCCESS : $FAILURE);
