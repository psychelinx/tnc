import json
import shutil
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import check_well_known as c  # noqa: E402

REPO = Path(__file__).resolve().parent.parent
FP1 = ":".join(["AB"] * 32)
FP2 = ":".join(["01"] * 32)


class CheckWellKnown(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / ".well-known").mkdir()
        shutil.copy(REPO / ".well-known/apple-app-site-association", self.tmp / ".well-known")
        shutil.copy(REPO / "apple-app-site-association", self.tmp)
        links = json.loads((REPO / ".well-known/assetlinks.json").read_text())
        links[0]["target"]["sha256_cert_fingerprints"] = [FP1]
        links[1]["target"]["sha256_cert_fingerprints"] = [FP2]
        self.write_links(links)

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def write_links(self, links):
        (self.tmp / ".well-known/assetlinks.json").write_text(json.dumps(links))

    def test_valid_files_pass(self):
        self.assertEqual(c.check(self.tmp), [])

    def test_committed_files_pass(self):
        self.assertEqual(c.check(REPO), [])

    def test_placeholders_fail(self):
        links = json.loads((self.tmp / ".well-known/assetlinks.json").read_text())
        links[0]["target"]["sha256_cert_fingerprints"] = ["<PLAY_APP_SIGNING_KEY_SHA256>"]
        self.write_links(links)
        self.assertTrue(any("placeholder" in e for e in c.check(self.tmp)))

    def test_invalid_json_fails(self):
        (self.tmp / ".well-known/assetlinks.json").write_text("[")
        self.assertTrue(any("invalid JSON" in e for e in c.check(self.tmp)))

    def test_webcredentials_fails(self):
        for rel in c.AASA:
            (self.tmp / rel).write_text('{"applinks":{},"webcredentials":{"apps":[]}}')
        self.assertTrue(any("webcredentials" in e for e in c.check(self.tmp)))

    def test_get_login_creds_fails(self):
        links = json.loads((self.tmp / ".well-known/assetlinks.json").read_text())
        links[0]["relation"] = ["delegate_permission/common.get_login_creds"]
        self.write_links(links)
        self.assertTrue(any("get_login_creds" in e for e in c.check(self.tmp)))

    def test_aasa_copies_must_match(self):
        (self.tmp / "apple-app-site-association").write_text('{"applinks":{}}')
        self.assertTrue(any("differ" in e for e in c.check(self.tmp)))

    def test_unexpected_package_fails(self):
        links = json.loads((self.tmp / ".well-known/assetlinks.json").read_text())
        links[0]["target"]["package_name"] = "com.example"
        self.write_links(links)
        self.assertTrue(any("unexpected package" in e for e in c.check(self.tmp)))

    def write_aasa(self, aasa):
        for rel in c.AASA:
            (self.tmp / rel).write_text(json.dumps(aasa))

    def aasa(self):
        return json.loads((self.tmp / c.AASA[0]).read_text())

    def test_widened_applinks_path_fails(self):
        for widened in ("*", "/*", "/code/*/../*"):
            aasa = self.aasa()
            aasa["applinks"]["details"][0]["components"].append({"/": widened})
            self.write_aasa(aasa)
            self.assertTrue(any("components" in e for e in c.check(self.tmp)), widened)

    def test_replaced_applinks_path_fails(self):
        aasa = self.aasa()
        aasa["applinks"]["details"][0]["components"] = [{"/": "*"}]
        self.write_aasa(aasa)
        self.assertTrue(any("components" in e for e in c.check(self.tmp)))

    def test_query_or_exclude_component_fails(self):
        aasa = self.aasa()
        aasa["applinks"]["details"][0]["components"][0]["?"] = {"doc": "*"}
        self.write_aasa(aasa)
        self.assertTrue(any("components" in e for e in c.check(self.tmp)))

    def test_wrong_app_id_fails(self):
        aasa = self.aasa()
        aasa["applinks"]["details"][0]["appIDs"] = ["ABCDE12345.com.example"]
        self.write_aasa(aasa)
        self.assertTrue(any("appIDs" in e for e in c.check(self.tmp)))

    def test_second_details_entry_fails(self):
        aasa = self.aasa()
        aasa["applinks"]["details"].append(dict(aasa["applinks"]["details"][0]))
        self.write_aasa(aasa)
        self.assertTrue(any("exactly one entry" in e for e in c.check(self.tmp)))

    def test_missing_applinks_fails(self):
        self.write_aasa({"appclips": {}})
        self.assertTrue(any("applinks only" in e for e in c.check(self.tmp)))

    def test_missing_package_fails(self):
        links = json.loads((self.tmp / ".well-known/assetlinks.json").read_text())
        self.write_links(links[:1])
        self.assertTrue(any("packages must be exactly" in e for e in c.check(self.tmp)))

    def test_duplicate_package_fails(self):
        links = json.loads((self.tmp / ".well-known/assetlinks.json").read_text())
        links[1]["target"]["package_name"] = links[0]["target"]["package_name"]
        self.write_links(links)
        self.assertTrue(any("packages must be exactly" in e for e in c.check(self.tmp)))

    def test_artifact_must_contain_well_known(self):
        tar_path = self.tmp / "artifact.tar"
        with tarfile.open(tar_path, "w") as tar:
            tar.add(REPO / "404.html", arcname="./404.html")
        self.assertTrue(any("assetlinks" in e for e in c.check_artifact(tar_path)))
        with tarfile.open(tar_path, "w") as tar:
            for rel in (c.ASSETLINKS, c.AASA[0], c.AASA[1], "404.html", ".nojekyll"):
                tar.add(REPO / rel, arcname="./" + rel)
        self.assertEqual(c.check_artifact(tar_path), [])


if __name__ == "__main__":
    unittest.main()
