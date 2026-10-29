package com.izforge.izpack.installer.bench.security;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.api.data.XPackFile;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.util.Collections;

import static org.junit.Assert.assertFalse;

/**
 * A multi-volume installation must apply the same target-location rule as the single-volume
 * installation.
 */
public class MultiVolumeSecurityTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void multiVolumeEntryDoesNotEscapeInstallDirectory() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.useVolume("vol0", "mv-owned");
        File src = InstallerFixture.source("mvolsrc", "mv-owned");
        XPackFile file = new XPackFile(src.getParentFile(), src, "${INSTALL_PATH}/mv.txt", null,
                                       OverrideType.OVERRIDE_TRUE, null, Blockable.BLOCKABLE_NONE);
        file.setArchiveFilePosition(0);
        InstallerFixture.target(file, "${INSTALL_PATH}/../escape/mv.txt");
        PackInfo pack = fixture.pack("pack1", false);
        InstallerFixture.addArchived(pack, file, src);
        fixture.prepare(Collections.singletonList(pack));

        fixture.multiVolumeUnpacker().run();

        assertFalse(new File(fixture.root(), "escape/mv.txt").exists());
    }
}
