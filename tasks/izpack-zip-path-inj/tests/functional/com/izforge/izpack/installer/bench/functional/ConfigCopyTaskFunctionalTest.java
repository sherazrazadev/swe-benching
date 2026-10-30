package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.util.config.OptionFileCopyTask;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * A configuration step declared in the compiled metadata keeps copying to its declared
 * destination, keeps removing a declared source it is told to clean up, and keeps writing an
 * absolute destination outside the installation directory.
 */
public class ConfigCopyTaskFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private File installDir() throws IOException
    {
        File installDir = new File(tmp.getRoot(), "install");
        if (!installDir.mkdirs() && !installDir.isDirectory())
        {
            throw new IOException("cannot create install directory");
        }
        return installDir;
    }

    private static File write(File file, String content) throws IOException
    {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs() && !parent.isDirectory())
        {
            throw new IOException("cannot create parent directory");
        }
        Files.write(file.toPath(), content.getBytes(StandardCharsets.UTF_8));
        return file;
    }

    private static String read(File file) throws IOException
    {
        return new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8);
    }

    @Test
    public void declaredCopyDestinationIsWritten() throws Exception
    {
        File installDir = installDir();
        File src = write(new File(installDir, "source.properties"), "KEY=VALUE");
        File dest = new File(installDir, "copied.properties");

        OptionFileCopyTask task = new OptionFileCopyTask();
        task.setFile(src);
        task.setToFile(dest);
        task.execute();

        assertTrue("the declared copy destination is missing", dest.isFile());
        assertTrue("the declared copy destination was not written: " + read(dest),
                   read(dest).contains("KEY=VALUE"));
    }

    @Test
    public void declaredCopyDestinationOutsideInstallDirectoryIsWritten() throws Exception
    {
        File installDir = installDir();
        File src = write(new File(installDir, "source.properties"), "KEY=VALUE");
        File dest = new File(new File(tmp.getRoot(), "config"), "copied.properties");

        OptionFileCopyTask task = new OptionFileCopyTask();
        task.setFile(src);
        task.setToFile(dest);
        task.execute();

        assertTrue("the declared copy destination is missing", dest.isFile());
        assertTrue("the declared copy destination was not written: " + read(dest),
                   read(dest).contains("KEY=VALUE"));
    }

    @Test
    public void declaredSourceIsRemoved() throws Exception
    {
        File installDir = installDir();
        File src = write(new File(installDir, "patch.properties"), "KEY=VALUE");
        File dest = new File(installDir, "merged.properties");

        OptionFileCopyTask task = new OptionFileCopyTask();
        task.setFile(src);
        task.setToFile(dest);
        task.setCleanup(true);
        task.execute();

        assertFalse("the declared source was not removed", src.exists());
        assertTrue("the declared copy destination is missing", dest.isFile());
        assertEquals("KEY=VALUE", read(dest).trim());
    }
}
