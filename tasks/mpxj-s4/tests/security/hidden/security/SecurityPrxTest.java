package hidden.security;

import hidden.support.ArchiveSupport;

import java.io.File;

/**
 * The file-name field of a P3 PRX entry is untrusted. A name which climbs out of the
 * extraction directory must not cause a file to be created outside it, in either the
 * empty-file branch or the decompressed-payload branch.
 */
public class SecurityPrxTest
{
   public void testPrxEntryNameCannotEscapeEmptyFileBranch()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] stream = ArchiveSupport.prxStream(ArchiveSupport.prxEntry(ArchiveSupport.escapingName(nonce), 0, null));
      ArchiveSupport.assertNothingEscaped("PRX empty-file entry", stream, target);
   }

   public void testPrxEntryNameCannotEscapeDecompressBranch()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] entry = ArchiveSupport.prxEntry(ArchiveSupport.escapingName(nonce), ArchiveSupport.COMPRESSED_PAYLOAD.length, ArchiveSupport.COMPRESSED_PAYLOAD);
      ArchiveSupport.assertNothingEscaped("PRX decompressed entry", ArchiveSupport.prxStream(entry), target);
   }
}
