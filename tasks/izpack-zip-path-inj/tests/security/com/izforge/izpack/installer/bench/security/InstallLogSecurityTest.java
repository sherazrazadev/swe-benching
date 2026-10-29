package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.installer.bench.support.WriterFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;

import static org.junit.Assert.assertFalse;

/**
 * The location of the log the installer writes from its configured values must not leave the
 * location the metadata declares, whether the value names the file directly or is the keyword
 * that derives it from another declared location.
 */
public class InstallLogSecurityTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void logFileDoesNotEscape() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        fixture.uninstallerPath("${INSTALL_PATH}/Uninstaller");
        fixture.uninstallerName("uninstaller.jar");
        fixture.variable(WriterFixture.LOG_PATH_VARIABLE, "${INSTALL_PATH}/../escape/install.log");

        fixture.write();

        assertFalse("the log was written outside the declared location",
                    new File(tmp.getRoot(), "escape/install.log").exists());
        assertFalse("a directory was created outside the declared location",
                    new File(tmp.getRoot(), "escape").exists());
    }

    @Test
    public void derivedLogFileDoesNotEscape() throws Exception
    {
        WriterFixture fixture = new WriterFixture(tmp.getRoot());
        fixture.uninstallerPath("${INSTALL_PATH}/../escape");
        fixture.uninstallerName("uninstaller.jar");
        fixture.variable(WriterFixture.LOG_PATH_VARIABLE, "default");

        fixture.write();

        assertFalse("the log was written outside the declared location",
                    new File(tmp.getRoot(), "escape/install.log").exists());
    }
}
