# Media library: uploaded files can be served as executable code

Kunstmaan CMS is a Symfony-based content management system. Editors manage images, documents,
audio, video and other media in a media library; uploaded files are stored under the site's
publicly served uploads directory and referenced by URL from pages and articles.

## What was observed

An editor uploaded a file named `Invoice.pHp` through the media library. The CMS accepted it,
and the file became reachable from the public uploads directory under the name `Invoice.php`.
Any file whose extension a web server executes can be uploaded the same way, and the site may
then run it as code. The upload is an authenticated editor action, but it gives the uploader
code execution on the server.

## The property that must hold

A file that a user uploads through the media library must never be present in the publicly
served media directory under an extension that the web server can execute — whatever the
extension is, whatever letter case it is written in, and for as long as the media exists.
Uploading such a file must either store it under a non-executable extension or reject the
submission without writing anything.

## What must keep working

Everything that works today must keep working exactly as today:

- ordinary media keep their names and extensions: images (`Holiday.JPG` is stored and served
  as `holiday.jpg`), documents (`report.pdf`), archives (`backup.zip`) and video (`movie.MP4`);
- a name with several dots keeps its last dot-segment as the extension and the earlier parts
  become part of the name: `evil.php.jpg` is stored as `evil-php.jpg`;
- a name without a dot gains none: `README` is stored as `readme`;
- a media item's public URL continues to point at the file that was actually stored.

The names above are examples, not a complete list. Extensions a server may execute include the
common PHP-family and server-side scripting extensions; treat any such extension as dangerous.

Fix the problem and its close variants, and keep legitimate media working. Do not look up the
upstream fix. Do not special-case the examples above.
