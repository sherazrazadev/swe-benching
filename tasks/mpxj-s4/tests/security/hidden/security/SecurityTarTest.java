package hidden.security;

import hidden.support.ArchiveSupport;

import java.io.File;

/**
 * A tar archive distributes an entry's path across the ustar name field, the ustar prefix
 * field, PAX extended-header records and GNU long-name records. Whichever of those carries
 * the name, it must not cause a file or directory to be created outside the extraction
 * directory.
 */
public class SecurityTarTest
{
   public void testTarNameFieldCannotEscape()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] stream = ArchiveSupport.tarEntry(ArchiveSupport.escapingName(nonce), "", '0', bytes("PAYLOAD"));
      ArchiveSupport.assertNothingEscaped("tar name field", stream, target);
   }

   public void testTarPrefixFieldCannotEscape()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] stream = ArchiveSupport.tarEntry(nonce, "..", '0', bytes("PAYLOAD"));
      ArchiveSupport.assertNothingEscaped("tar prefix field", stream, target);
   }

   public void testTarPaxPathCannotEscape()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] stream = ArchiveSupport.concat(
         ArchiveSupport.paxEntry(ArchiveSupport.escapingName(nonce)),
         ArchiveSupport.tarEntry("benign.txt", "", '0', bytes("PAYLOAD")));
      ArchiveSupport.assertNothingEscaped("tar PAX path", stream, target);
   }

   public void testTarGnuLongNameCannotEscape()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] stream = ArchiveSupport.concat(
         ArchiveSupport.gnuLongName(ArchiveSupport.escapingName(nonce)),
         ArchiveSupport.tarEntry("benign.txt", "", '0', bytes("PAYLOAD")));
      ArchiveSupport.assertNothingEscaped("tar GNU long name", stream, target);
   }

   public void testTarDirectoryEntryCannotEscape()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] stream = ArchiveSupport.tarEntry(ArchiveSupport.escapingName(nonce), "", '5', new byte[0]);
      ArchiveSupport.assertNothingEscaped("tar directory entry", stream, target);
   }

   private static byte[] bytes(String value)
   {
      return value.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1);
   }
}
