package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.util.config.SingleConfigurableTask;
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
 * A configuration step declared in the compiled metadata keeps writing its declared file and
 * removing its declared patch file.
 */
public class ConfigTaskFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private static File installDir(TemporaryFolder tmp) throws IOException
    {
        File installDir = new File(tmp.getRoot(), "install");
        if (!installDir.mkdirs() && !installDir.isDirectory())
        {
            throw new IOException("cannot create install directory");
        }
        return installDir;
    }

    @Test
    public void declaredConfigurationFileIsPatched() throws Exception
    {
        File installDir = installDir(tmp);
        File toFile = new File(installDir, "conf/app.properties");

        SingleOptionFileTask task = new SingleOptionFileTask();
        task.setToFile(toFile);
        task.setCreate(true);
        SingleConfigurableTask.Entry entry = new SingleConfigurableTask.Entry();
        entry.setKey("app.name");
        entry.setValue("demo");
        task.addEntry(entry);

        task.execute();

        assertTrue("the configuration file is missing", toFile.isFile());
        assertEquals("the configuration file was not patched", "app.name=demo",
                     new String(Files.readAllBytes(toFile.toPath()), StandardCharsets.UTF_8).trim());
    }

    @Test
    public void declaredPatchFileIsRemoved() throws Exception
    {
        File installDir = installDir(tmp);
        File oldFile = new File(installDir, "patch.properties");
        Files.write(oldFile.toPath(), "old=true".getBytes(StandardCharsets.UTF_8));

        SingleOptionFileTask task = new SingleOptionFileTask();
        task.setToFile(new File(installDir, "conf/app.properties"));
        task.setOldFile(oldFile);
        task.setCleanup(true);
        task.setCreate(true);

        task.execute();

        assertFalse("the declared patch file was not removed", oldFile.exists());
        assertTrue("the configuration file is missing",
                   new File(installDir, "conf/app.properties").isFile());
    }

    @Test
    public void configurationFileOutsideTheInstallDirectoryIsPatched() throws Exception
    {
        installDir(tmp);
        File toFile = new File(new File(tmp.getRoot(), "config"), "app.properties");

        SingleOptionFileTask task = new SingleOptionFileTask();
        task.setToFile(toFile);
        task.setCreate(true);
        SingleConfigurableTask.Entry entry = new SingleConfigurableTask.Entry();
        entry.setKey("app.name");
        entry.setValue("demo");
        task.addEntry(entry);

        task.execute();

        assertTrue("the configuration file is missing", toFile.isFile());
        assertEquals("app.name=demo",
                     new String(Files.readAllBytes(toFile.toPath()), StandardCharsets.UTF_8).trim());
    }
}
