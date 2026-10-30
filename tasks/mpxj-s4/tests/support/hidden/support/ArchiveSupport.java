package hidden.support;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Random;

import org.mpxj.MPXJException;
import org.mpxj.ProjectFile;
import org.mpxj.reader.UniversalProjectReader;

/**
 * Builders for the archive streams the tests open, plus the bookkeeping the tests use to
 * decide whether an entry escaped the extraction directory. All values are computed here,
 * in the test, so that a hardened product helper cannot alter what a test expects.
 */
public final class ArchiveSupport
{
   /**
    * A short random marker which fits inside the shortest entry-name field used by the formats.
    */
   public static String nonce()
   {
      return String.format("%08x", RANDOM.nextInt());
   }

   /**
    * The file (or directory) a traversal entry would create just outside the extraction directory.
    */
   public static File escapedTarget(String nonce)
   {
      return new File(System.getProperty("java.io.tmpdir"), nonce);
   }

   /**
    * A relative name which climbs out of the extraction directory and lands on the target.
    */
   public static String escapingName(String nonce)
   {
      return "../" + nonce;
   }

   /**
    * Run the reader over the stream and assert that nothing appeared at the target. Any error
    * the product raises is accepted; what matters is that no file or directory was created
    * outside the extraction directory.
    */
   public static void assertNothingEscaped(String label, byte[] stream, File target)
   {
      // A stale marker from an earlier run must not look like this run's side effect.
      delete(target);

      try
      {
         read(stream);
      }

      catch (Throwable ex)
      {
         // A refusal (or any other error) is acceptable; the side effect is what we check.
      }

      boolean escaped = target.exists();
      delete(target);
      if (escaped)
      {
         throw new AssertionError(label + ": a file or directory was created outside the extraction directory: " + target);
      }
   }

   /**
    * Open a schedule through the library's public universal reader.
    */
   public static ProjectFile read(byte[] data) throws MPXJException
   {
      return new UniversalProjectReader().read(new ByteArrayInputStream(data));
   }

   /**
    * Delete a file or directory tree without relying on product helpers.
    */
   public static void delete(File file)
   {
      if (file == null || !file.exists())
      {
         return;
      }

      File[] children = file.listFiles();
      if (children != null)
      {
         for (File child : children)
         {
            delete(child);
         }
      }
      file.delete();
   }

   // ------------------------------------------------------------------------------------
   // P3 PRX / SureTrak STX self-extracting archive streams
   // ------------------------------------------------------------------------------------

   /**
    * Wrap PRX entries in the self-extracting executable shape the universal reader recognises.
    */
   public static byte[] prxStream(byte[] entries)
   {
      byte[] data = new byte[27000 + entries.length];
      data[0] = 'M';
      data[1] = 'Z';
      data[1024] = 'N';
      data[1025] = 'E';
      put(data, 1312, "!Self-Extracting Primavera Project");
      System.arraycopy(entries, 0, data, 27000, entries.length);
      return data;
   }

   /**
    * Build one PRX entry.
    */
   public static byte[] prxEntry(String name, int dataSize, byte[] payload)
   {
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      out.writeBytes(new byte[8]);
      byte[] nameBytes = new byte[13];
      byte[] encoded = name.getBytes(StandardCharsets.ISO_8859_1);
      System.arraycopy(encoded, 0, nameBytes, 0, Math.min(encoded.length, nameBytes.length));
      out.writeBytes(nameBytes);
      out.writeBytes(int32(dataSize));
      if (payload != null)
      {
         out.writeBytes(payload);
      }
      return out.toByteArray();
   }

   /**
    * Wrap SureTrak STX entries in the self-extracting executable shape the universal reader recognises.
    */
   public static byte[] stxStream(byte[] entries)
   {
      byte[] data = new byte[32772 + entries.length];
      data[0] = 'M';
      data[1] = 'Z';
      data[1024] = (byte) 0x55;
      data[1025] = (byte) 0x8B;
      put(data, 32768, "PRX3");
      System.arraycopy(entries, 0, data, 32772, entries.length);
      return data;
   }

   /**
    * Build one SureTrak STX entry.
    */
   public static byte[] stxEntry(String name, int dataSize, byte[] payload)
   {
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      out.writeBytes(int32(dataSize));
      out.writeBytes(new byte[4]);
      byte[] nameBytes = new byte[260];
      byte[] encoded = name.getBytes(StandardCharsets.ISO_8859_1);
      System.arraycopy(encoded, 0, nameBytes, 0, Math.min(encoded.length, nameBytes.length));
      out.writeBytes(nameBytes);
      if (payload != null)
      {
         out.writeBytes(payload);
      }
      return out.toByteArray();
   }

   // ------------------------------------------------------------------------------------
   // tar archive streams
   // ------------------------------------------------------------------------------------

   public static byte[] tarHeader(String name, String prefix, char typeFlag, long size)
   {
      byte[] header = new byte[512];
      put(header, 0, name);
      put(header, 345, prefix);
      put(header, 100, "0000644");
      put(header, 108, "0000000");
      put(header, 116, "0000000");
      put(header, 124, octal(size, 11));
      put(header, 136, "00000000000");
      header[156] = (byte) typeFlag;
      put(header, 257, "ustar");
      put(header, 263, "00");
      put(header, 265, "root");
      put(header, 297, "root");
      for (int i = 148; i < 156; i++)
      {
         header[i] = ' ';
      }
      int sum = 0;
      for (byte b : header)
      {
         sum += b & 0xFF;
      }
      put(header, 148, octal(sum, 6) + "\0 ");
      return header;
   }

   public static byte[] tarEntry(String name, String prefix, char typeFlag, byte[] data)
   {
      ByteArrayOutputStream out = new ByteArrayOutputStream();
      out.writeBytes(tarHeader(name, prefix, typeFlag, data.length));
      out.writeBytes(padBlock(data));
      return out.toByteArray();
   }

   /**
    * A PAX extended header naming the entry which follows.
    */
   public static byte[] paxEntry(String path)
   {
      String record = "path=" + path + "\n";
      int length = record.length() + 2;
      while (true)
      {
         String full = length + " " + record;
         if (full.length() == length)
         {
            break;
         }
         length = full.length();
      }
      String full = length + " " + record;
      return tarEntry("PaxHeaders/entry", "", 'x', full.getBytes(StandardCharsets.ISO_8859_1));
   }

   /**
    * A GNU long-name header naming the entry which follows.
    */
   public static byte[] gnuLongName(String name)
   {
      byte[] encoded = name.getBytes(StandardCharsets.ISO_8859_1);
      byte[] data = new byte[encoded.length + 1];
      System.arraycopy(encoded, 0, data, 0, encoded.length);
      return tarEntry("././@LongLink", "", 'L', data);
   }

   public static byte[] concat(byte[]... parts)
   {
      int length = 0;
      for (byte[] part : parts)
      {
         length += part.length;
      }
      byte[] result = new byte[length];
      int offset = 0;
      for (byte[] part : parts)
      {
         System.arraycopy(part, 0, result, offset, part.length);
         offset += part.length;
      }
      return result;
   }

   // ------------------------------------------------------------------------------------
   // zip archive streams and schedule content
   // ------------------------------------------------------------------------------------

   public static byte[] zipStream(String[][] entries)
   {
      try
      {
         ByteArrayOutputStream out = new ByteArrayOutputStream();
         java.util.zip.ZipOutputStream zip = new java.util.zip.ZipOutputStream(out);
         for (String[] entry : entries)
         {
            zip.putNextEntry(new java.util.zip.ZipEntry(entry[0]));
            if (entry[1] != null)
            {
               zip.write(entry[1].getBytes(StandardCharsets.ISO_8859_1));
            }
            zip.closeEntry();
         }
         // Incompressible filler keeps the archive larger than the reader's sample window.
         zip.putNextEntry(new java.util.zip.ZipEntry("zz-filler.bin"));
         zip.write(FILLER);
         zip.closeEntry();
         zip.close();
         return out.toByteArray();
      }

      catch (IOException ex)
      {
         throw new IllegalStateException(ex);
      }
   }

   /**
    * A small but complete MSPDI schedule, padded so the reader's fixed-size sample sees it.
    */
   public static String mspdi(String projectName)
   {
      StringBuilder xml = new StringBuilder();
      xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
      xml.append("<Project xmlns=\"http://schemas.microsoft.com/project\">\n");
      xml.append("<SaveVersion>14</SaveVersion>\n");
      xml.append("<Name>").append(projectName).append("</Name>\n");
      xml.append("<Title>").append(projectName).append("</Title>\n");
      xml.append("</Project>\n");
      while (xml.length() < 700)
      {
         xml.append(' ');
      }
      return xml.toString();
   }

   /**
    * A valid decompressed payload (the documented PKWare example decompresses to "AIAIAIAIAIAIA").
    */
   public static final byte[] COMPRESSED_PAYLOAD = {
      (byte) 0x00, (byte) 0x04, (byte) 0x82, (byte) 0x24,
      (byte) 0x25, (byte) 0x8F, (byte) 0x80, (byte) 0x7F
   };

   private static byte[] int32(int value)
   {
      return new byte[] {(byte) value, (byte) (value >> 8), (byte) (value >> 16), (byte) (value >> 24)};
   }

   private static byte[] padBlock(byte[] data)
   {
      int padding = (512 - (data.length % 512)) % 512;
      byte[] result = new byte[data.length + padding];
      System.arraycopy(data, 0, result, 0, data.length);
      return result;
   }

   private static String octal(long value, int length)
   {
      String text = Long.toOctalString(value);
      while (text.length() < length - 1)
      {
         text = "0" + text;
      }
      return text;
   }

   private static void put(byte[] target, int offset, String value)
   {
      byte[] encoded = value.getBytes(StandardCharsets.ISO_8859_1);
      System.arraycopy(encoded, 0, target, offset, encoded.length);
   }

   private static final Random RANDOM = new Random();
   private static final byte[] FILLER = filler();

   private static byte[] filler()
   {
      byte[] data = new byte[1024];
      new Random(7).nextBytes(data);
      return data;
   }
}
