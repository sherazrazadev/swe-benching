package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.util.config.SingleOptionFileTask;
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
 * A configuration step declared in the compiled metadata names the files it writes and the
 * patch file it removes; those locations must not reach outside the location the metadata
 * declares.
 */
public class ConfigTaskSecurityTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void configurationFileDoesNotEscape() throws Exception
    {
        File installDir = new File(tmp.getRoot(), "install");
        if (!installDir.mkdirs() && !installDir.isDirectory())
        {
            throw new IOException("cannot create install directory");
        }
        SingleOptionFileTask task = new SingleOptionFileTask();
        task.setToFile(new File(installDir, "../escape/app.properties"));
        task.setCreate(true);

        try
        {
            task.execute();
        }
        catch (Exception expected)
        {
            // refused
        }

        assertFalse("a configuration file was written outside the declared location",
                    new File(tmp.getRoot(), "escape/app.properties").exists());
        assertFalse("a directory was created outside the declared location",
                    new File(tmp.getRoot(), "escape").exists());
    }

    @Test
    public void patchFileOutsideIsNotDeleted() throws Exception
    {
        File installDir = new File(tmp.getRoot(), "install");
        if (!installDir.mkdirs() && !installDir.isDirectory())
        {
            throw new IOException("cannot create install directory");
        }
        File outside = new File(tmp.getRoot(), "escape");
        if (!outside.mkdirs() && !outside.isDirectory())
        {
            throw new IOException("cannot create outside directory");
        }
        File victim = new File(outside, "victim.properties");
        Files.write(victim.toPath(), "KEEP".getBytes(StandardCharsets.UTF_8));

        SingleOptionFileTask task = new SingleOptionFileTask();
        task.setToFile(new File(installDir, "app.properties"));
        task.setOldFile(new File(installDir, "../escape/victim.properties"));
        task.setCleanup(true);
        task.setCreate(true);

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
