package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.api.data.XPackFile;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;

import static org.junit.Assert.assertEquals;

/**
 * A legitimate multi-volume entry keeps installing from its volume.
 */
public class MultiVolumeFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void entryInstallsFromVolume() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        fixture.useVolume("vol0", "mv-legit");
        File src = InstallerFixture.source("mvfunc", "mv-legit");
        XPackFile file = new XPackFile(src.getParentFile(), src, "${INSTALL_PATH}/mv.txt", null,
                                       OverrideType.OVERRIDE_TRUE, null, Blockable.BLOCKABLE_NONE);
        file.setArchiveFilePosition(0);
        PackInfo pack = fixture.pack("pack1", false);
        InstallerFixture.addArchived(pack, file, src);
        fixture.prepare(Collections.singletonList(pack));

        fixture.multiVolumeUnpacker().run();

        assertEquals("mv-legit", new String(Files.readAllBytes(
                new File(fixture.installDir(), "mv.txt").toPath()), StandardCharsets.UTF_8));
    }
}
