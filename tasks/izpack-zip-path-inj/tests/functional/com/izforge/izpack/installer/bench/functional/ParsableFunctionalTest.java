package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.api.data.ParsableFile;
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
 * A file-to-rewrite location inside the installation directory keeps being rewritten.
 */
public class ParsableFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void fileInsideInstallDirectoryIsRewritten() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        File src = InstallerFixture.source("parsefunc", "owned");
        PackInfo pack = fixture.pack("pack1", false);
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/ok.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, null, null, null);
        pack.addParsable(new ParsableFile("${INSTALL_PATH}/parse.txt", null, null, Collections.emptyList()));
        fixture.prepare(Collections.singletonList(pack));

        File parseMe = new File(fixture.installDir(), "parse.txt");
        Files.write(parseMe.toPath(), "ORIGINAL".getBytes(StandardCharsets.UTF_8));

        fixture.unpacker().run();

        assertEquals("CHANGED",
                     new String(Files.readAllBytes(parseMe.toPath()), StandardCharsets.UTF_8));
    }
}
