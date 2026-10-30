package hidden.security;

import hidden.support.ArchiveSupport;

import java.io.File;

/**
 * The file-name field of a SureTrak STX entry is untrusted in exactly the same way as the
 * PRX entry name, through a different reader and a wider field.
 */
public class SecurityStxTest
{
   public void testStxEntryNameCannotEscapeEmptyFileBranch()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] stream = ArchiveSupport.stxStream(ArchiveSupport.stxEntry(ArchiveSupport.escapingName(nonce), 0, null));
      ArchiveSupport.assertNothingEscaped("STX empty-file entry", stream, target);
   }

   public void testStxEntryNameCannotEscapeDecompressBranch()
   {
      String nonce = ArchiveSupport.nonce();
      File target = ArchiveSupport.escapedTarget(nonce);
      byte[] entry = ArchiveSupport.stxEntry(ArchiveSupport.escapingName(nonce), ArchiveSupport.COMPRESSED_PAYLOAD.length, ArchiveSupport.COMPRESSED_PAYLOAD);
      ArchiveSupport.assertNothingEscaped("STX decompressed entry", ArchiveSupport.stxStream(entry), target);
   }
}
