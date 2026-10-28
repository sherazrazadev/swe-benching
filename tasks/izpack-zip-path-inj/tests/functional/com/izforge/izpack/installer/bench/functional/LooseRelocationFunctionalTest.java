package com.izforge.izpack.installer.bench.functional;

import com.izforge.izpack.api.data.Blockable;
import com.izforge.izpack.api.data.OverrideType;
import com.izforge.izpack.api.data.PackInfo;
import com.izforge.izpack.installer.bench.support.InstallerFixture;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

import static org.junit.Assert.assertEquals;

/**
 * Legitimate relocations keep working, both relative to the target directory and absolute.
 */
public class LooseRelocationFunctionalTest
{
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void relativeRelocationInstalls() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        File src = InstallerFixture.source("loosefunc", "relocated");
        PackInfo pack = fixture.pack("pack1", true);
        Map<String, String> additionals = new HashMap<>();
        additionals.put("installTarget", "sub/loose.txt");
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/loose.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, additionals, null, null);
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertEquals("relocated", new String(Files.readAllBytes(
                new File(fixture.installDir(), "sub/loose.txt").toPath()), StandardCharsets.UTF_8));
    }

    @Test
    public void absoluteRelocationInstalls() throws Exception
    {
        InstallerFixture fixture = new InstallerFixture(tmp);
        File src = InstallerFixture.source("looseabs", "absolute-loose");
        File destination = new File(fixture.root(), "absolute-loose.txt");
        PackInfo pack = fixture.pack("pack1", true);
        Map<String, String> additionals = new HashMap<>();
        additionals.put("installTarget", destination.getAbsolutePath());
        pack.addFile(src.getParentFile(), src, "${INSTALL_PATH}/loose.txt", null, OverrideType.OVERRIDE_TRUE,
                     null, Blockable.BLOCKABLE_NONE, additionals, null, null);
        fixture.prepare(Collections.singletonList(pack));

        fixture.unpacker().run();

        assertEquals("absolute-loose", new String(Files.readAllBytes(
                destination.toPath()), StandardCharsets.UTF_8));
    }
}
