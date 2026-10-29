package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.installer.bench.support.WriterFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.io.IOException;

import static org.junit.Assert.assertFalse;

/**
 * The location the installer prepares its removal data at comes from the compiled metadata; it
 * must not create directories or files outside the location the metadata declares.
 */
public class UninstallerOutputSecurityTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void uninstallerDirectoryDoesNotEscape() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        fixture.uninstallerPath("${INSTALL_PATH}/../escape");
        fixture.uninstallerName("uninstaller.jar");

        fixture.write();

        assertFalse("removal data was written outside the declared location",
                    new File(tmp.getRoot(), "escape/uninstaller.jar").exists());
        assertFalse("a directory was created outside the declared location",
                    new File(tmp.getRoot(), "escape").exists());
    }

    @Test
    public void uninstallerFileNameDoesNotEscape() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        File outside = new File(tmp.getRoot(), "escape");
        if (!outside.mkdirs() && !outside.isDirectory())
        {
            throw new IOException("cannot create outside directory");
        }
        fixture.uninstallerPath(new File(fixture.installDir(), "Uninstaller").getAbsolutePath());
        fixture.uninstallerName("../../escape/evil.jar");

        fixture.write();

        assertFalse("removal data was written outside the declared location",
                    new File(outside, "evil.jar").exists());
    }
}
