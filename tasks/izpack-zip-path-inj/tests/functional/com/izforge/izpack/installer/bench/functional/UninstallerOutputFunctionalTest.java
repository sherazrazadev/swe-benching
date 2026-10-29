package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.installer.bench.support.WriterFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;

import static org.junit.Assert.assertTrue;

/**
 * A removal location that stays inside the installation directory keeps being written.
 */
public class UninstallerOutputFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void declaredRemovalDirectoryIsWritten() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        fixture.uninstallerPath("${INSTALL_PATH}/Uninstaller");
        fixture.uninstallerName("uninstaller.jar");

        assertTrue("the removal data was not written", fixture.write());

        File jar = new File(new File(fixture.installDir(), "Uninstaller"), "uninstaller.jar");
        assertTrue("the removal data is missing", jar.isFile());
        assertTrue("the removal data is empty", jar.length() > 0);
    }

    @Test
    public void removalDirectoryOutsideTheInstallDirectoryIsWritten() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        File outside = new File(tmp.getRoot(), "removal");
        fixture.uninstallerPath(outside.getAbsolutePath());
        fixture.uninstallerName("uninstaller.jar");

        assertTrue("the removal data was not written", fixture.write());

        assertTrue("the removal data is missing", new File(outside, "uninstaller.jar").isFile());
    }
}
