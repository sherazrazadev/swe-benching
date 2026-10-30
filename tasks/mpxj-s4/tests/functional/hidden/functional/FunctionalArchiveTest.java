package hidden.functional;

import hidden.support.ArchiveSupport;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import org.mpxj.ProjectFile;
import org.mpxj.common.InputStreamHelper;

/**
 * Legitimate archive content must keep expanding exactly as it does today: ordinary entry
 * names are accepted, entries stored in subdirectories keep their relative positions, and
 * archives which carry a schedule are still read.
 */
public class FunctionalArchiveTest
{
   public void testPrxLegitimateEntryAccepted() throws Exception
   {
      byte[] stream = ArchiveSupport.prxStream(ArchiveSupport.prxEntry("README.TXT", 0, null));
      assertAcceptedWithoutError("PRX plain entry", stream);
   }

   public void testPrxLegitimateCompressedEntryAccepted() throws Exception
   {
      byte[] entry = ArchiveSupport.prxEntry("DATA.TXT", ArchiveSupport.COMPRESSED_PAYLOAD.length, ArchiveSupport.COMPRESSED_PAYLOAD);
      assertAcceptedWithoutError("PRX compressed entry", ArchiveSupport.prxStream(entry));
   }

   public void testStxLegitimateEntryAccepted() throws Exception
   {
      byte[] stream = ArchiveSupport.stxStream(ArchiveSupport.stxEntry("README.TXT", 0, null));
      assertAcceptedWithoutError("STX plain entry", stream);
   }

   public void testStxLegitimateCompressedEntryAccepted() throws Exception
   {
      byte[] entry = ArchiveSupport.stxEntry("DATA.TXT", ArchiveSupport.COMPRESSED_PAYLOAD.length, ArchiveSupport.COMPRESSED_PAYLOAD);
      assertAcceptedWithoutError("STX compressed entry", ArchiveSupport.stxStream(entry));
   }

   public void testTarNestedScheduleRead() throws Exception
   {
      byte[] stream = ArchiveSupport.concat(
         ArchiveSupport.tarEntry("folder/sub/schedule.xml", "", '0', ArchiveSupport.mspdi("NESTED-TAR").getBytes(StandardCharsets.ISO_8859_1)),
         new byte[1024]);
      ProjectFile project = ArchiveSupport.read(stream);
      assertProject("tar nested schedule", project, "NESTED-TAR");
   }

   public void testTarDuplicateBaseNamesKeepTheirDirectories() throws Exception
   {
      byte[] stream = ArchiveSupport.concat(
         ArchiveSupport.tarEntry("a/schedule.xml", "", '0', ArchiveSupport.mspdi("TAR-FIRST").getBytes(StandardCharsets.ISO_8859_1)),
         ArchiveSupport.tarEntry("b/schedule.xml", "", '0', "not a schedule".getBytes(StandardCharsets.ISO_8859_1)),
         new byte[1024]);
      ProjectFile project = ArchiveSupport.read(stream);
      assertProject("tar duplicate base names", project, "TAR-FIRST");
   }

   public void testZipDuplicateBaseNamesKeepTheirDirectories() throws Exception
   {
      byte[] stream = ArchiveSupport.zipStream(new String[][] {
         {"a/schedule.xml", ArchiveSupport.mspdi("ZIP-FIRST")},
         {"b/schedule.xml", "not a schedule"}
      });
      ProjectFile project = ArchiveSupport.read(stream);
      assertProject("zip duplicate base names", project, "ZIP-FIRST");
   }

   public void testZipNestedPathsAndDirectoryEntriesExtracted()
   {
      byte[] stream = ArchiveSupport.zipStream(new String[][] {
         {"top/sub/hello.txt", "HELLO"},
         {"top/empty/", null}
      });
      File dir = null;
      try
      {
         dir = InputStreamHelper.writeZipStreamToTempDir(new ByteArrayInputStream(stream));
         File nested = new File(dir, "top/sub/hello.txt");
         if (!nested.isFile())
         {
            throw new AssertionError("nested zip entry not extracted at its stored path: " + nested);
         }
         String content = new String(Files.readAllBytes(nested.toPath()), StandardCharsets.UTF_8);
         if (!content.equals("HELLO"))
         {
            throw new AssertionError("nested zip entry content changed: " + content);
         }
         File emptyDir = new File(dir, "top/empty");
         if (!emptyDir.isDirectory())
         {
            throw new AssertionError("zip directory entry not extracted at its stored path: " + emptyDir);
         }
      }

      catch (java.io.IOException ex)
      {
         throw new AssertionError("legitimate zip expansion failed: " + ex);
      }

      finally
      {
         ArchiveSupport.delete(dir);
      }
   }

   private static void assertAcceptedWithoutError(String label, byte[] stream)
   {
      try
      {
         ArchiveSupport.read(stream);
      }

      catch (Exception ex)
      {
         throw new AssertionError(label + " was refused: " + ex, ex);
      }
   }

   private static void assertProject(String label, ProjectFile project, String expectedName)
   {
      if (project == null)
      {
         throw new AssertionError(label + ": the schedule inside the archive was not read");
      }
      String name = project.getProjectProperties().getName();
      if (!expectedName.equals(name))
      {
         throw new AssertionError(label + ": read the wrong schedule: " + name);
      }
   }
}
