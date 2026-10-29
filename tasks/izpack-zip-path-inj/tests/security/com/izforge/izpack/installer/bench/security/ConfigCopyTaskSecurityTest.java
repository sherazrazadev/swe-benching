package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.util.config.IniFileCopyTask;
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
 * A configuration step declared in the compiled metadata copies a file to a destination it
 * names and may remove the source it names; those locations must not reach outside the
 * location the metadata declares.
 */
public class ConfigCopyTaskSecurityTest
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

    @Test
    public void copyDestinationDoesNotEscape() throws Exception
    {
        File installDir = installDir();
        File src = write(new File(installDir, "source.properties"), "KEY=VALUE");

        OptionFileCopyTask task = new OptionFileCopyTask();
        task.setFile(src);
        task.setToFile(new File(installDir, "../escape/copied.properties"));

        try
        {
            task.execute();
        }
        catch (Exception expected)
        {
            // refused
        }

        assertFalse("a file was copied outside the declared location",
                    new File(tmp.getRoot(), "escape/copied.properties").exists());
        assertFalse("a directory was created outside the declared location",
                    new File(tmp.getRoot(), "escape").exists());
    }

    @Test
    public void iniCopyDestinationDoesNotEscape() throws Exception
    {
        File installDir = installDir();
        File src = write(new File(installDir, "source.properties"), "KEY=VALUE");

        IniFileCopyTask task = new IniFileCopyTask();
        task.setFile(src);
        task.setToFile(new File(installDir, "../escape/copied.properties"));

        try
        {
            task.execute();
        }
        catch (Exception expected)
        {
            // refused
        }

        assertFalse("a file was copied outside the declared location",
                    new File(tmp.getRoot(), "escape/copied.properties").exists());
        assertFalse("a directory was created outside the declared location",
                    new File(tmp.getRoot(), "escape").exists());
    }

    @Test
    public void cleanupDoesNotRemoveFileOutside() throws Exception
    {
        File installDir = installDir();
        File outside = new File(tmp.getRoot(), "escape");
        if (!outside.mkdirs() && !outside.isDirectory())
        {
            throw new IOException("cannot create outside directory");
        }
        File victim = write(new File(outside, "victim.properties"), "KEEP");

        OptionFileCopyTask task = new OptionFileCopyTask();
        task.setFile(new File(installDir, "../escape/victim.properties"));
        task.setToFile(new File(installDir, "out.properties"));
        task.setCleanup(true);

        try
        {
            task.execute();
        }
        catch (Exception expected)
        {
            // refused
        }

        assertTrue("a file outside the declared location was removed", victim.isFile());
        assertEquals("a file outside the declared location was changed", "KEEP",
                     new String(Files.readAllBytes(victim.toPath()), StandardCharsets.UTF_8));
    }
}
